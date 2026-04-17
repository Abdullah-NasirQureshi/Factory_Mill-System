const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// Helper: get active season_id
async function getActiveSeason(factory_id) {
  const [rows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
  );
  return rows[0]?.id || null;
}

// GET /api/customers?search=
const getCustomers = async (req, res) => {
  const { factory_id } = req.user;
  const { search } = req.query;
  const season_id = await getActiveSeason(factory_id);

  // outstanding = opening balance for this season + unpaid sales in this season
  let sql = `SELECT c.*,
               COALESCE((
                 SELECT ob.balance FROM season_opening_balances ob
                 WHERE ob.entity_type = 'CUSTOMER' AND ob.entity_id = c.id
                   AND ob.season_id = ${season_id || 'NULL'}
               ), 0)
               + COALESCE((
                 SELECT SUM(s.remaining_amount) FROM sales s
                 WHERE s.customer_id = c.id AND s.status = 'ACTIVE'
                   ${season_id ? `AND s.season_id = ${season_id}` : ''}
               ), 0) AS outstanding_balance
             FROM customers c
             WHERE c.factory_id = ? AND c.is_deleted = FALSE`;
  const params = [factory_id];
  if (search) {
    sql += ' AND (c.name ILIKE ? OR c.phone ILIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY c.name';
  const [rows] = await db.query(sql, params);
  return ok(res, { customers: rows });
};

// GET /api/customers/:id
const getCustomer = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const season_id = await getActiveSeason(factory_id);

  const [cust] = await db.query(
    'SELECT * FROM customers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!cust[0]) return fail(res, 'NOT_FOUND', 'Customer not found', 404);

  // sales filtered to active season
  const salesSql = season_id
    ? `SELECT s.id, s.invoice_number, s.total_amount, s.paid_amount,
              s.remaining_amount, s.status, s.created_at,
              COALESCE(json_agg(json_build_object('product', p.name, 'weight', bw.weight_value,
                          'unit', bw.unit, 'quantity', si.quantity,
                          'price', si.price, 'total', si.total)
              ) FILTER (WHERE si.id IS NOT NULL), '[]'::json) AS items
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       LEFT JOIN products p ON p.id = si.product_id
       LEFT JOIN bag_weights bw ON bw.id = si.weight_id
       WHERE s.customer_id = ? AND s.factory_id = ? AND s.season_id = ?
       GROUP BY s.id ORDER BY s.created_at DESC`
    : `SELECT s.id, s.invoice_number, s.total_amount, s.paid_amount,
              s.remaining_amount, s.status, s.created_at,
              COALESCE(json_agg(json_build_object('product', p.name, 'weight', bw.weight_value,
                          'unit', bw.unit, 'quantity', si.quantity,
                          'price', si.price, 'total', si.total)
              ) FILTER (WHERE si.id IS NOT NULL), '[]'::json) AS items
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       LEFT JOIN products p ON p.id = si.product_id
       LEFT JOIN bag_weights bw ON bw.id = si.weight_id
       WHERE s.customer_id = ? AND s.factory_id = ?
       GROUP BY s.id ORDER BY s.created_at DESC`;

  const salesParams = season_id ? [id, factory_id, season_id] : [id, factory_id];
  const [sales] = await db.query(salesSql, salesParams);

  // opening balance for this season
  const [obRows] = await db.query(
    `SELECT balance FROM season_opening_balances
     WHERE entity_type = 'CUSTOMER' AND entity_id = ? AND season_id = ?`,
    [id, season_id || 0]
  );
  const opening_balance = parseFloat(obRows[0]?.balance || 0);

  const season_sales_outstanding = sales
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + parseFloat(s.remaining_amount), 0);

  const outstanding_balance = opening_balance + season_sales_outstanding;

  return ok(res, { customer: cust[0], sales, outstanding_balance, opening_balance });
};

// POST /api/customers
const createCustomer = async (req, res) => {
  const { factory_id } = req.user;
  const { name, phone, address } = req.body;
  if (!name) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Customer name is required');

  const [result] = await db.query(
    'INSERT INTO customers (factory_id, name, phone, address) VALUES (?, ?, ?, ?)',
    [factory_id, name, phone || null, address || null]
  );
  const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [result[0].id]);
  return ok(res, { customer: rows[0] }, 201);
};

// PUT /api/customers/:id
const updateCustomer = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const { name, phone, address } = req.body;

  const [check] = await db.query(
    'SELECT id FROM customers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!check[0]) return fail(res, 'NOT_FOUND', 'Customer not found', 404);
  if (!name) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Customer name is required');

  await db.query(
    'UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?',
    [name, phone || null, address || null, id]
  );
  const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [id]);
  return ok(res, { customer: rows[0] });
};

// DELETE /api/customers/:id  — admin only
const deleteCustomer = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { id } = req.params;

  const [check] = await db.query(
    'SELECT id FROM customers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!check[0]) return fail(res, 'NOT_FOUND', 'Customer not found', 404);

  // block if has sales or outstanding balance
  const [sales] = await db.query(
    "SELECT COUNT(*) AS cnt FROM sales WHERE customer_id = ? AND status = 'ACTIVE'",
    [id]
  );
  if (parseInt(sales[0].cnt) > 0)
    return fail(res, 'BUSINESS_CANNOT_DELETE', 'Customer has active sales and cannot be deleted');

  const [bal] = await db.query(
    "SELECT COALESCE(SUM(remaining_amount),0) AS bal FROM sales WHERE customer_id = ?",
    [id]
  );
  if (parseFloat(bal[0].bal) > 0)
    return fail(res, 'BUSINESS_CANNOT_DELETE', 'Customer has outstanding balance and cannot be deleted');

  await db.query(
    'UPDATE customers SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? WHERE id = ?',
    [user_id, id]
  );
  return ok(res, { message: 'Customer deleted' });
};

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
