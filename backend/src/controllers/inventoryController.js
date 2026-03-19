const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// GET /api/inventory
const getInventory = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    `SELECT i.id, i.quantity, i.updated_at,
            p.id AS product_id, p.name AS product_name, p.status AS product_status,
            bw.id AS weight_id, bw.weight_value, bw.unit
     FROM inventory i
     JOIN products p ON p.id = i.product_id
     JOIN bag_weights bw ON bw.id = i.weight_id
     WHERE i.factory_id = ?
     ORDER BY p.name, bw.weight_value`,
    [factory_id]
  );
  return ok(res, { inventory: rows });
};

// GET /api/inventory/low-stock?threshold=10
const getLowStock = async (req, res) => {
  const { factory_id } = req.user;
  const threshold = parseFloat(req.query.threshold) || 10;
  const [rows] = await db.query(
    `SELECT i.id, i.quantity, p.name AS product_name,
            bw.weight_value, bw.unit
     FROM inventory i
     JOIN products p ON p.id = i.product_id
     JOIN bag_weights bw ON bw.id = i.weight_id
     WHERE i.factory_id = ? AND i.quantity <= ? AND p.status = 'ACTIVE'
     ORDER BY i.quantity ASC`,
    [factory_id, threshold]
  );
  return ok(res, { low_stock: rows });
};

// POST /api/inventory/add
const addStock = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { product_id, weight_id, quantity, note } = req.body;

  if (!product_id || !weight_id || !quantity)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'product_id, weight_id and quantity are required');
  if (quantity <= 0)
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'Quantity must be positive');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // upsert inventory row
    await conn.query(
      `INSERT INTO inventory (factory_id, product_id, weight_id, quantity)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (factory_id, product_id, weight_id) DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity`,
      [factory_id, product_id, weight_id, quantity]
    );

    // stock transaction record
    await conn.query(
      `INSERT INTO stock_transactions (factory_id, product_id, weight_id, type, quantity, note)
       VALUES (?, ?, ?, 'ADD', ?, ?)`,
      [factory_id, product_id, weight_id, quantity, note || null]
    );

    await conn.commit();
    const [inv] = await conn.query(
      'SELECT * FROM inventory WHERE factory_id = ? AND product_id = ? AND weight_id = ?',
      [factory_id, product_id, weight_id]
    );
    return ok(res, { inventory: inv[0] }, 201);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// POST /api/inventory/adjust
const adjustStock = async (req, res) => {
  const { factory_id } = req.user;
  const { product_id, weight_id, quantity, note } = req.body;

  if (!product_id || !weight_id || quantity === undefined)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'product_id, weight_id and quantity are required');
  if (!note)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'A note/reason is required for adjustments');

  // check current stock
  const [inv] = await db.query(
    'SELECT * FROM inventory WHERE factory_id = ? AND product_id = ? AND weight_id = ?',
    [factory_id, product_id, weight_id]
  );
  const current = inv[0]?.quantity || 0;
  const newQty = parseFloat(current) + parseFloat(quantity);
  if (newQty < 0)
    return fail(res, 'BUSINESS_NEGATIVE_BALANCE', 'Adjustment would result in negative inventory');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO inventory (factory_id, product_id, weight_id, quantity)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (factory_id, product_id, weight_id) DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity`,
      [factory_id, product_id, weight_id, quantity]
    );

    await conn.query(
      `INSERT INTO stock_transactions (factory_id, product_id, weight_id, type, quantity, note)
       VALUES (?, ?, ?, 'ADJUST', ?, ?)`,
      [factory_id, product_id, weight_id, quantity, note]
    );

    await conn.commit();
    const [updated] = await conn.query(
      'SELECT * FROM inventory WHERE factory_id = ? AND product_id = ? AND weight_id = ?',
      [factory_id, product_id, weight_id]
    );
    return ok(res, { inventory: updated[0] });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// GET /api/inventory/stock-transactions
const getStockTransactions = async (req, res) => {
  const { factory_id } = req.user;
  const { product_id, type, from, to } = req.query;

  let sql = `SELECT st.*, p.name AS product_name, bw.weight_value, bw.unit
             FROM stock_transactions st
             JOIN products p ON p.id = st.product_id
             JOIN bag_weights bw ON bw.id = st.weight_id
             WHERE st.factory_id = ?`;
  const params = [factory_id];

  if (product_id) { sql += ' AND st.product_id = ?'; params.push(product_id); }
  if (type)       { sql += ' AND st.type = ?';       params.push(type); }
  if (from)       { sql += ' AND st.created_at >= ?'; params.push(from); }
  if (to)         { sql += ' AND st.created_at <= ?'; params.push(to); }

  sql += ' ORDER BY st.created_at DESC';
  const [rows] = await db.query(sql, params);
  return ok(res, { transactions: rows });
};

// PUT /api/inventory/:id
const updateInventory = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const { product_id, weight_id, quantity } = req.body;

  if (!product_id || !weight_id || quantity === undefined)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'product_id, weight_id and quantity are required');
  if (quantity < 0)
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'Quantity cannot be negative');

  try {
    // Check the row belongs to this factory
    const [existing] = await db.query(
      'SELECT id FROM inventory WHERE id = ? AND factory_id = ?', [id, factory_id]
    );
    if (!existing[0]) return fail(res, 'NOT_FOUND', 'Inventory record not found', 404);

    await db.query(
      `UPDATE inventory SET product_id = ?, weight_id = ?, quantity = ? WHERE id = ? AND factory_id = ?`,
      [product_id, weight_id, quantity, id, factory_id]
    );
    return ok(res, { message: 'Inventory updated' });
  } catch (e) {
    console.error('updateInventory error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// DELETE /api/inventory/:id
const deleteInventory = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;

  try {
    const [existing] = await db.query(
      'SELECT id FROM inventory WHERE id = ? AND factory_id = ?', [id, factory_id]
    );
    if (!existing[0]) return fail(res, 'NOT_FOUND', 'Inventory record not found', 404);

    await db.query('DELETE FROM inventory WHERE id = ? AND factory_id = ?', [id, factory_id]);
    return ok(res, { message: 'Inventory record deleted' });
  } catch (e) {
    console.error('deleteInventory error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// POST /api/inventory/weight — get or create a custom weight
const getOrCreateWeight = async (req, res) => {
  const { weight_value, unit = 'kg' } = req.body;
  if (!weight_value || isNaN(weight_value) || Number(weight_value) <= 0)
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'Valid weight_value is required');

  try {
    await db.query(
      `INSERT INTO bag_weights (weight_value, unit) VALUES (?, ?) ON CONFLICT (weight_value, unit) DO NOTHING`,
      [weight_value, unit]
    );
    const [rows] = await db.query(
      'SELECT * FROM bag_weights WHERE weight_value = ? AND unit = ?', [weight_value, unit]
    );
    return ok(res, { weight: rows[0] });
  } catch (e) {
    console.error('getOrCreateWeight error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

module.exports = { getInventory, getLowStock, addStock, adjustStock, getStockTransactions, updateInventory, deleteInventory, getOrCreateWeight };
