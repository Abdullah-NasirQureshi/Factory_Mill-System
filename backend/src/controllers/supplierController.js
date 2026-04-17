const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// Helper: get active season_id
async function getActiveSeason(factory_id) {
  const [rows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
  );
  return rows[0]?.id || null;
}

// GET /api/suppliers?search=
const getSuppliers = async (req, res) => {
  const { factory_id } = req.user;
  const { search } = req.query;
  const season_id = await getActiveSeason(factory_id);

  let sql = `SELECT s.*,
               COALESCE((
                 SELECT ob.balance FROM season_opening_balances ob
                 WHERE ob.entity_type = 'SUPPLIER' AND ob.entity_id = s.id
                   AND ob.season_id = ${season_id || 'NULL'}
               ), 0)
               + COALESCE((
                 SELECT SUM(p.remaining_amount) FROM purchases p
                 WHERE p.supplier_id = s.id AND p.status = 'ACTIVE'
                   ${season_id ? `AND p.season_id = ${season_id}` : ''}
               ), 0) AS outstanding_payable
             FROM suppliers s
             WHERE s.factory_id = ? AND s.is_deleted = FALSE`;
  const params = [factory_id];
  if (search) {
    sql += ' AND (s.name ILIKE ? OR s.phone ILIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY s.name';
  const [rows] = await db.query(sql, params);
  return ok(res, { suppliers: rows });
};

// GET /api/suppliers/:id
const getSupplier = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const season_id = await getActiveSeason(factory_id);

  const [sup] = await db.query(
    'SELECT * FROM suppliers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!sup[0]) return fail(res, 'NOT_FOUND', 'Supplier not found', 404);

  const purchSql = season_id
    ? `SELECT pu.id, pu.invoice_number, pu.total_amount, pu.paid_amount,
              pu.remaining_amount, pu.purchase_date, pu.status, pu.created_at,
              COALESCE(json_agg(json_build_object('product_name', pi.product_name, 'quantity', pi.quantity,
                          'unit_price', pi.unit_price, 'total', pi.total)
              ) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS items
       FROM purchases pu
       LEFT JOIN purchase_items pi ON pi.purchase_id = pu.id
       WHERE pu.supplier_id = ? AND pu.factory_id = ? AND pu.season_id = ?
       GROUP BY pu.id ORDER BY pu.created_at DESC`
    : `SELECT pu.id, pu.invoice_number, pu.total_amount, pu.paid_amount,
              pu.remaining_amount, pu.purchase_date, pu.status, pu.created_at,
              COALESCE(json_agg(json_build_object('product_name', pi.product_name, 'quantity', pi.quantity,
                          'unit_price', pi.unit_price, 'total', pi.total)
              ) FILTER (WHERE pi.id IS NOT NULL), '[]'::json) AS items
       FROM purchases pu
       LEFT JOIN purchase_items pi ON pi.purchase_id = pu.id
       WHERE pu.supplier_id = ? AND pu.factory_id = ?
       GROUP BY pu.id ORDER BY pu.created_at DESC`;

  const purchParams = season_id ? [id, factory_id, season_id] : [id, factory_id];
  const [purchases] = await db.query(purchSql, purchParams);

  const [obRows] = await db.query(
    `SELECT balance FROM season_opening_balances
     WHERE entity_type = 'SUPPLIER' AND entity_id = ? AND season_id = ?`,
    [id, season_id || 0]
  );
  const opening_balance = parseFloat(obRows[0]?.balance || 0);

  const season_purchases_outstanding = purchases
    .filter((p) => p.status === 'ACTIVE')
    .reduce((sum, p) => sum + parseFloat(p.remaining_amount), 0);

  const outstanding_payable = opening_balance + season_purchases_outstanding;

  return ok(res, { supplier: sup[0], purchases, outstanding_payable, opening_balance });
};

// POST /api/suppliers
const createSupplier = async (req, res) => {
  const { factory_id } = req.user;
  const { name, phone, address } = req.body;
  if (!name) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Supplier name is required');

  const [result] = await db.query(
    'INSERT INTO suppliers (factory_id, name, phone, address) VALUES (?, ?, ?, ?)',
    [factory_id, name, phone || null, address || null]
  );
  const [rows] = await db.query('SELECT * FROM suppliers WHERE id = ?', [result[0].id]);
  return ok(res, { supplier: rows[0] }, 201);
};

// PUT /api/suppliers/:id
const updateSupplier = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const { name, phone, address } = req.body;

  const [check] = await db.query(
    'SELECT id FROM suppliers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!check[0]) return fail(res, 'NOT_FOUND', 'Supplier not found', 404);
  if (!name) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Supplier name is required');

  await db.query(
    'UPDATE suppliers SET name = ?, phone = ?, address = ? WHERE id = ?',
    [name, phone || null, address || null, id]
  );
  const [rows] = await db.query('SELECT * FROM suppliers WHERE id = ?', [id]);
  return ok(res, { supplier: rows[0] });
};

// DELETE /api/suppliers/:id  — admin only
const deleteSupplier = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { id } = req.params;

  const [check] = await db.query(
    'SELECT id FROM suppliers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!check[0]) return fail(res, 'NOT_FOUND', 'Supplier not found', 404);

  const [purch] = await db.query(
    "SELECT COUNT(*) AS cnt FROM purchases WHERE supplier_id = ? AND status = 'ACTIVE'",
    [id]
  );
  if (parseInt(purch[0].cnt) > 0)
    return fail(res, 'BUSINESS_CANNOT_DELETE', 'Supplier has active purchases and cannot be deleted');

  const [bal] = await db.query(
    'SELECT COALESCE(SUM(remaining_amount),0) AS bal FROM purchases WHERE supplier_id = ?',
    [id]
  );
  if (parseFloat(bal[0].bal) > 0)
    return fail(res, 'BUSINESS_CANNOT_DELETE', 'Supplier has outstanding payables and cannot be deleted');

  await db.query(
    'UPDATE suppliers SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? WHERE id = ?',
    [user_id, id]
  );
  return ok(res, { message: 'Supplier deleted' });
};

module.exports = { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier };
