const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// GET /api/banks
const getBanks = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    'SELECT * FROM bank_accounts WHERE factory_id = ? AND is_deleted = FALSE ORDER BY bank_name',
    [factory_id]
  );
  return ok(res, { banks: rows });
};

// POST /api/banks  — admin only
const createBank = async (req, res) => {
  const { factory_id } = req.user;
  const { bank_name, account_title, account_number, balance } = req.body;
  if (!bank_name || !account_title || !account_number)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'bank_name, account_title and account_number are required');

  const [result] = await db.query(
    'INSERT INTO bank_accounts (factory_id, bank_name, account_title, account_number, balance) VALUES (?, ?, ?, ?, ?)',
    [factory_id, bank_name, account_title, account_number, parseFloat(balance) || 0]
  );
  const [rows] = await db.query('SELECT * FROM bank_accounts WHERE id = ?', [result[0].id]);
  return ok(res, { bank: rows[0] }, 201);
};

// PUT /api/banks/:id  — admin only
const updateBank = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const { bank_name, account_title, account_number } = req.body;

  const [check] = await db.query(
    'SELECT id FROM bank_accounts WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!check[0]) return fail(res, 'NOT_FOUND', 'Bank account not found', 404);

  await db.query(
    'UPDATE bank_accounts SET bank_name = ?, account_title = ?, account_number = ? WHERE id = ?',
    [bank_name, account_title, account_number, id]
  );
  const [rows] = await db.query('SELECT * FROM bank_accounts WHERE id = ?', [id]);
  return ok(res, { bank: rows[0] });
};

// PUT /api/banks/:id/balance  — admin only, direct balance set
const setBankBalance = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { id } = req.params;
  const { balance, notes } = req.body;
  if (balance === undefined) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'balance is required');
  if (parseFloat(balance) < 0) return fail(res, 'VALIDATION_INVALID_FORMAT', 'Balance cannot be negative');

  const [check] = await db.query(
    'SELECT * FROM bank_accounts WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!check[0]) return fail(res, 'NOT_FOUND', 'Bank account not found', 404);

  const diff = parseFloat(balance) - parseFloat(check[0].balance);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('UPDATE bank_accounts SET balance = ? WHERE id = ?', [balance, id]);

    await conn.query(
      `INSERT INTO transactions (factory_id, transaction_type, source_type, payment_method, bank_id, amount, notes)
       VALUES (?, 'ADJUST', 'SYSTEM', 'BANK', ?, ?, ?)`,
      [factory_id, id, Math.abs(diff), notes || `Bank balance set to ${balance}`]
    );

    await conn.commit();
    const [rows] = await db.query('SELECT * FROM bank_accounts WHERE id = ?', [id]);
    return ok(res, { bank: rows[0] });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// DELETE /api/banks/:id  — admin only
const deleteBank = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { id } = req.params;

  const [check] = await db.query(
    'SELECT * FROM bank_accounts WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
    [id, factory_id]
  );
  if (!check[0]) return fail(res, 'NOT_FOUND', 'Bank account not found', 404);
  if (parseFloat(check[0].balance) !== 0)
    return fail(res, 'BUSINESS_CANNOT_DELETE', 'Bank account has non-zero balance and cannot be deleted');

  const [txns] = await db.query(
    'SELECT COUNT(*) AS cnt FROM transactions WHERE bank_id = ?', [id]
  );
  if (parseInt(txns[0].cnt) > 0)
    return fail(res, 'BUSINESS_CANNOT_DELETE', 'Bank account has associated transactions and cannot be deleted');

  await db.query(
    'UPDATE bank_accounts SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? WHERE id = ?',
    [user_id, id]
  );
  return ok(res, { message: 'Bank account deleted' });
};

module.exports = { getBanks, createBank, updateBank, setBankBalance, deleteBank };
