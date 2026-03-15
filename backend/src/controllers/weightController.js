const db = require('../config/db');
const { ok } = require('../utils/response');

// GET /api/weights
const getWeights = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM bag_weights ORDER BY weight_value');
  return ok(res, { weights: rows });
};

// GET /api/weights/by-product/:productId  — weights that have inventory > 0
const getWeightsByProduct = async (req, res) => {
  const { factory_id } = req.user;
  const { productId } = req.params;
  const [rows] = await db.query(
    `SELECT bw.*, i.quantity FROM bag_weights bw
     JOIN inventory i ON i.weight_id = bw.id
     WHERE i.product_id = ? AND i.factory_id = ? AND i.quantity > 0
     ORDER BY bw.weight_value`,
    [productId, factory_id]
  );
  return ok(res, { weights: rows });
};

module.exports = { getWeights, getWeightsByProduct };
