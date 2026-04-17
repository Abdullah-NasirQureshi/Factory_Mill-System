const db = require('../config/db');
const { ok, fail } = require('../utils/response');
const { nextDocNumber } = require('../utils/docNumber');

// Helper: get active season_id for factory (returns null if none — for backward compat)
async function getActiveSeason(factory_id) {
  const [rows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1',
    [factory_id]
  );
  return rows[0]?.id || null;
}

// GET /api/transactions
const getTransactions = async (req, res) => {
  const { factory_id } = req.user;
  const { type, method, from, to, source_type } = req.query;

  const season_id = await getActiveSeason(factory_id);

  let sql = `SELECT t.*, ba.bank_name,
               CASE t.source_type
                 WHEN 'CUSTOMER' THEN c.name
                 WHEN 'SUPPLIER' THEN s.name
                 WHEN 'EMPLOYEE' THEN e.name
                 ELSE 'System'
               END AS source_name
             FROM transactions t
             LEFT JOIN bank_accounts ba ON ba.id = t.bank_id
             LEFT JOIN customers c ON t.source_type = 'CUSTOMER' AND c.id = t.source_id
             LEFT JOIN suppliers s ON t.source_type = 'SUPPLIER' AND s.id = t.source_id
             LEFT JOIN employees e ON t.source_type = 'EMPLOYEE' AND e.id = t.source_id
             WHERE t.factory_id = ? AND t.is_deleted = FALSE`;
  const params = [factory_id];

  if (season_id) { sql += ' AND t.season_id = ?'; params.push(season_id); }
  if (type)        { sql += ' AND t.transaction_type = ?'; params.push(type); }
  if (method)      { sql += ' AND t.payment_method = ?';   params.push(method); }
  if (source_type) { sql += ' AND t.source_type = ?';      params.push(source_type); }
  if (from)        { sql += ' AND t.created_at >= ?';      params.push(from); }
  if (to)          { sql += ' AND t.created_at <= ?';      params.push(to); }
  sql += ' ORDER BY t.created_at DESC';

  const [rows] = await db.query(sql, params);
  return ok(res, { transactions: rows });
};

// GET /api/transactions/:id
const getTransaction = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const [rows] = await db.query(
    `SELECT t.*, ba.bank_name,
       CASE t.source_type WHEN 'CUSTOMER' THEN c.name WHEN 'SUPPLIER' THEN s.name ELSE 'System' END AS source_name
     FROM transactions t
     LEFT JOIN bank_accounts ba ON ba.id = t.bank_id
     LEFT JOIN customers c ON t.source_type = 'CUSTOMER' AND c.id = t.source_id
     LEFT JOIN suppliers s ON t.source_type = 'SUPPLIER' AND s.id = t.source_id
     WHERE t.id = ? AND t.factory_id = ?`,
    [id, factory_id]
  );
  if (!rows[0]) return fail(res, 'NOT_FOUND', 'Transaction not found', 404);
  return ok(res, { transaction: rows[0] });
};

// GET /api/transactions/:id/voucher  — for ADJUST type transactions
const getAdjustmentVoucher = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const [rows] = await db.query(
    `SELECT t.*, ba.bank_name FROM transactions t
     LEFT JOIN bank_accounts ba ON ba.id = t.bank_id
     WHERE t.id = ? AND t.factory_id = ? AND t.transaction_type = 'ADJUST'`,
    [id, factory_id]
  );
  if (!rows[0]) return fail(res, 'NOT_FOUND', 'Adjustment transaction not found', 404);

  // generate JV number if not already assigned
  if (!rows[0].voucher_number) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const jv = await nextDocNumber(conn, factory_id, 'JV');
      await conn.query('UPDATE transactions SET voucher_number = ? WHERE id = ?', [jv, id]);
      await conn.commit();
      rows[0].voucher_number = jv;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  const [settings] = await db.query('SELECT * FROM settings WHERE factory_id = ?', [factory_id]);
  return ok(res, { voucher: { transaction: rows[0], settings: settings[0] || {} } });
};

module.exports = { getTransactions, getTransaction, getAdjustmentVoucher };
