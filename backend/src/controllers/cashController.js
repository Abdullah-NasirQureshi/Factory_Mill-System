const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// GET /api/cash
const getCash = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query('SELECT * FROM cash_accounts WHERE factory_id = ?', [factory_id]);
  return ok(res, { cash: rows[0] || { factory_id, balance: 0 } });
};

// PUT /api/cash/balance  — admin only, direct balance set
const setCashBalance = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { balance, notes } = req.body;
  if (balance === undefined) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'balance is required');
  if (parseFloat(balance) < 0) return fail(res, 'VALIDATION_INVALID_FORMAT', 'Balance cannot be negative');

  const [current] = await db.query('SELECT balance FROM cash_accounts WHERE factory_id = ?', [factory_id]);
  const oldBalance = parseFloat(current[0]?.balance || 0);
  const diff = parseFloat(balance) - oldBalance;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO cash_accounts (factory_id, balance) VALUES (?, ?)
       ON CONFLICT (factory_id) DO UPDATE SET balance = EXCLUDED.balance`,
      [factory_id, balance]
    );

    // central ledger record
    await conn.query(
      `INSERT INTO transactions (factory_id, transaction_type, source_type, payment_method, amount, notes)
       VALUES (?, 'ADJUST', 'SYSTEM', 'CASH', ?, ?)`,
      [factory_id, Math.abs(diff), notes || `Cash balance set to ${balance}`]
    );

    await conn.commit();
    const [updated] = await conn.query('SELECT * FROM cash_accounts WHERE factory_id = ?', [factory_id]);
    return ok(res, { cash: updated[0] });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { getCash, setCashBalance };
