const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// GET /api/suppliers?search=
const getSuppliers = async (req, res) => {
  const { factory_id } = req.user;
  const { search } = req.query;
  let sql = `SELECT s.*,
               COALESCE(SUM(p.remaining_amount), 0) AS outstanding_payable
             FROM suppliers s
             LEFT JOIN purchases p ON p.supplier_id = s.id AND p.status = 'ACTIVE'
             WHERE s.factory_id = ? AND s.is_deleted = FALSE`;
  const params = [factory_id];
  if (search) {
    sql += ' AND (s.name LIKE ? OR s.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' GROUP BY s.id ORDER BY s.name';
  const [rows] = await db.query(sql, params);
  return ok(res, { suppliers: rows });
};

// GET /api/suppliers/:id
const getSupplier = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;

  const [sup] = await db.query(
    'SELECT * FROM suppliers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!sup[0]) return fail(res, 'NOT_FOUND', 'Supplier not found', 404);

  const [purchases] = await db.query(
    `SELECT pu.id, pu.invoice_number, pu.total_amount, pu.paid_amount,
            pu.remaining_amount, pu.purchase_date, pu.status, pu.created_at,
            COALESCE(
              JSON_ARRAYAGG(
                JSON_OBJECT('product_name', pi.product_name, 'quantity', pi.quantity,
                            'unit_price', pi.unit_price, 'total', pi.total)
              ), JSON_ARRAY()
            ) AS items
     FROM purchases pu
     LEFT JOIN purchase_items pi ON pi.purchase_id = pu.id
     WHERE pu.supplier_id = ? AND pu.factory_id = ?
     GROUP BY pu.id ORDER BY pu.created_at DESC`,
    [id, factory_id]
  );

  const outstanding_payable = purchases
    .filter((p) => p.status === 'ACTIVE')
    .reduce((sum, p) => sum + parseFloat(p.remaining_amount), 0);

  return ok(res, { supplier: sup[0], purchases, outstanding_payable });
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
  const [rows] = await db.query('SELECT * FROM suppliers WHERE id = ?', [result.id]);
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
  if (purch[0].cnt > 0)
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
