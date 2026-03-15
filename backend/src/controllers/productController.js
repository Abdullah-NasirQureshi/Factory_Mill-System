const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// GET /api/products
const getProducts = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    'SELECT * FROM products WHERE factory_id = ? ORDER BY name',
    [factory_id]
  );
  return ok(res, { products: rows });
};

// GET /api/products/active  — only active, used by billing
const getActiveProducts = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    `SELECT p.*, 
      (SELECT COUNT(*) FROM inventory i WHERE i.product_id = p.id AND i.factory_id = ? AND i.quantity > 0) AS available_weights
     FROM products p WHERE p.factory_id = ? AND p.status = 'ACTIVE' ORDER BY p.name`,
    [factory_id, factory_id]
  );
  return ok(res, { products: rows });
};

// POST /api/products
const createProduct = async (req, res) => {
  const { factory_id } = req.user;
  const { name } = req.body;
  if (!name) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Product name is required');

  const [result] = await db.query(
    'INSERT INTO products (factory_id, name) VALUES (?, ?)',
    [factory_id, name]
  );
  const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
  return ok(res, { product: rows[0] }, 201);
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Product name is required');

  const [check] = await db.query('SELECT id FROM products WHERE id = ? AND factory_id = ?', [id, factory_id]);
  if (!check[0]) return fail(res, 'NOT_FOUND', 'Product not found', 404);

  await db.query('UPDATE products SET name = ? WHERE id = ?', [name, id]);
  const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
  return ok(res, { product: rows[0] });
};

// PUT /api/products/:id/status
const updateProductStatus = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status))
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'Status must be ACTIVE or INACTIVE');

  const [check] = await db.query('SELECT id FROM products WHERE id = ? AND factory_id = ?', [id, factory_id]);
  if (!check[0]) return fail(res, 'NOT_FOUND', 'Product not found', 404);

  await db.query('UPDATE products SET status = ? WHERE id = ?', [status, id]);
  return ok(res, { message: `Product ${status.toLowerCase()}` });
};

module.exports = { getProducts, getActiveProducts, createProduct, updateProduct, updateProductStatus };
