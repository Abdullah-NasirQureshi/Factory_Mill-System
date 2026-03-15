const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// GET /api/customers?search=
const getCustomers = async (req, res) => {
  const { factory_id } = req.user;
  const { search } = req.query;
  let sql = `SELECT c.*,
               COALESCE(SUM(s.remaining_amount), 0) AS outstanding_balance
             FROM customers c
             LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'ACTIVE'
             WHERE c.factory_id = ? AND c.is_deleted = FALSE`;
  const params = [factory_id];
  if (search) {
    sql += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' GROUP BY c.id ORDER BY c.name';
  const [rows] = await db.query(sql, params);
  return ok(res, { customers: rows });
};

// GET /api/customers/:id
const getCustomer = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;

  const [cust] = await db.query(
    'SELECT * FROM customers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!cust[0]) return fail(res, 'NOT_FOUND', 'Customer not found', 404);

  // purchase history with items
  const [sales] = await db.query(
    `SELECT s.id, s.invoice_number, s.total_amount, s.paid_amount,
            s.remaining_amount, s.status, s.created_at,
            COALESCE(
              json_agg(
                json_build_object('product', p.name, 'weight', bw.weight_value,
                            'unit', bw.unit, 'quantity', si.quantity,
                            'price', si.price, 'total', si.total)
              ) FILTER (WHERE si.id IS NOT NULL), '[]'::json
            ) AS items
     FROM sales s
     LEFT JOIN sale_items si ON si.sale_id = s.id
     LEFT JOIN products p ON p.id = si.product_id
     LEFT JOIN bag_weights bw ON bw.id = si.weight_id
     WHERE s.customer_id = ? AND s.factory_id = ?
     GROUP BY s.id ORDER BY s.created_at DESC`,
    [id, factory_id]
  );

  const outstanding_balance = sales
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + parseFloat(s.remaining_amount), 0);

  return ok(res, { customer: cust[0], sales, outstanding_balance });
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
