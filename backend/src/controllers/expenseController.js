const db = require('../config/db');
const { ok, fail } = require('../utils/response');
const { getActiveSeasonId } = require('../utils/activeSeason');

// GET /api/expenses/groups
const getGroups = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const [groups] = await db.query(
      `SELECT g.id, g.name, g.is_active,
              json_agg(
                json_build_object('id', k.id, 'name', k.name, 'is_active', k.is_active)
                ORDER BY k.name
              ) FILTER (WHERE k.id IS NOT NULL AND k.is_active = true) AS khatas
       FROM expense_groups g
       LEFT JOIN expense_khatas k ON k.group_id = g.id AND k.factory_id = g.factory_id AND k.is_active = true
       WHERE g.factory_id = ? AND g.is_active = true
       GROUP BY g.id, g.name, g.is_active
       ORDER BY g.name`,
      [factory_id]
    );
    return ok(res, { groups: groups.map(g => ({ ...g, khatas: g.khatas || [] })) });
  } catch (e) {
    console.error('getGroups error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// POST /api/expenses/groups
const createGroup = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { name } = req.body;
    if (!name || !name.trim()) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Group name is required');

    // If a soft-deleted group with the same name exists, reactivate it
    const [existing] = await db.query(
      'SELECT id FROM expense_groups WHERE factory_id = ? AND LOWER(name) = LOWER(?) AND is_active = false',
      [factory_id, name.trim()]
    );
    if (existing[0]) {
      await db.query('UPDATE expense_groups SET is_active = true WHERE id = ?', [existing[0].id]);
      return ok(res, { group: { id: existing[0].id, name: name.trim(), is_active: true, khatas: [] } }, 201);
    }

    const [, , result] = await db.query(
      'INSERT INTO expense_groups (factory_id, name) VALUES (?, ?)',
      [factory_id, name.trim()]
    );
    return ok(res, { group: { id: result.insertId, name: name.trim(), is_active: true, khatas: [] } }, 201);
  } catch (e) {
    console.error('createGroup error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// PUT /api/expenses/groups/:id
const updateGroup = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { id } = req.params;
    const { name, is_active } = req.body;
    const [existing] = await db.query(
      'SELECT id FROM expense_groups WHERE id = ? AND factory_id = ?', [id, factory_id]
    );
    if (!existing[0]) return fail(res, 'NOT_FOUND', 'Group not found', 404);
    const fields = [];
    const vals = [];
    if (name !== undefined) { fields.push('name = ?'); vals.push(name.trim()); }
    if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active); }
    if (!fields.length) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Nothing to update');
    vals.push(id, factory_id);
    await db.query('UPDATE expense_groups SET ' + fields.join(', ') + ' WHERE id = ? AND factory_id = ?', vals);
    return ok(res, { message: 'Group updated' });
  } catch (e) {
    console.error('updateGroup error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// POST /api/expenses/khatas
const createKhata = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { group_id, name } = req.body;
    if (!group_id || !name || !name.trim())
      return fail(res, 'VALIDATION_REQUIRED_FIELD', 'group_id and name are required');
    const [grp] = await db.query(
      'SELECT id FROM expense_groups WHERE id = ? AND factory_id = ?', [group_id, factory_id]
    );
    if (!grp[0]) return fail(res, 'NOT_FOUND', 'Group not found', 404);

    // If a soft-deleted khata with the same name exists in the same group, reactivate it
    const [existing] = await db.query(
      'SELECT id FROM expense_khatas WHERE factory_id = ? AND group_id = ? AND LOWER(name) = LOWER(?) AND is_active = false',
      [factory_id, group_id, name.trim()]
    );
    if (existing[0]) {
      await db.query('UPDATE expense_khatas SET is_active = true WHERE id = ?', [existing[0].id]);
      return ok(res, { khata: { id: existing[0].id, group_id, name: name.trim(), is_active: true } }, 201);
    }

    const [, , result] = await db.query(
      'INSERT INTO expense_khatas (factory_id, group_id, name) VALUES (?, ?, ?)',
      [factory_id, group_id, name.trim()]
    );
    return ok(res, { khata: { id: result.insertId, group_id, name: name.trim(), is_active: true } }, 201);
  } catch (e) {
    console.error('createKhata error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// PUT /api/expenses/khatas/:id
const updateKhata = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { id } = req.params;
    const { name, is_active } = req.body;
    const [existing] = await db.query(
      'SELECT id FROM expense_khatas WHERE id = ? AND factory_id = ?', [id, factory_id]
    );
    if (!existing[0]) return fail(res, 'NOT_FOUND', 'Khata not found', 404);
    const fields = [];
    const vals = [];
    if (name !== undefined) { fields.push('name = ?'); vals.push(name.trim()); }
    if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active); }
    if (!fields.length) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Nothing to update');
    vals.push(id, factory_id);
    await db.query('UPDATE expense_khatas SET ' + fields.join(', ') + ' WHERE id = ? AND factory_id = ?', vals);
    return ok(res, { message: 'Khata updated' });
  } catch (e) {
    console.error('updateKhata error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// GET /api/expenses
const getExpenses = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { from, to, group_id, khata_id } = req.query;

    const [seasonRows] = await db.query(
      'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
    );
    const season_id = seasonRows[0]?.id || null;

    let sql = `SELECT e.id, e.description, e.amount, e.payment_method, e.expense_date, e.created_at,
                      g.name AS group_name, k.name AS khata_name, ba.bank_name
               FROM expenses e
               JOIN expense_groups g ON g.id = e.group_id
               JOIN expense_khatas k ON k.id = e.khata_id
               LEFT JOIN bank_accounts ba ON ba.id = e.bank_id
               WHERE e.factory_id = ?`;
    const params = [factory_id];
    if (season_id) { sql += ' AND e.season_id = ?'; params.push(season_id); }
    if (from)     { sql += ' AND DATE(e.expense_date) >= ?'; params.push(from); }
    if (to)       { sql += ' AND DATE(e.expense_date) <= ?'; params.push(to); }
    if (group_id) { sql += ' AND e.group_id = ?'; params.push(group_id); }
    if (khata_id) { sql += ' AND e.khata_id = ?'; params.push(khata_id); }
    sql += ' ORDER BY e.expense_date DESC, e.created_at DESC';
    const [rows] = await db.query(sql, params);
    return ok(res, { expenses: rows });
  } catch (e) {
    console.error('getExpenses error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// POST /api/expenses
const createExpense = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { group_id, khata_id, description, amount, payment_method, bank_id, expense_date } = req.body;

  if (!group_id || !khata_id || !amount || !payment_method)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'group_id, khata_id, amount, payment_method are required');
  if (Number(amount) <= 0)
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'Amount must be positive');
  if (!['CASH', 'BANK'].includes(payment_method))
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'payment_method must be CASH or BANK');
  if (payment_method === 'BANK' && !bank_id)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'bank_id is required when payment_method is BANK');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (payment_method === 'CASH') {
      const [cash] = await conn.query('SELECT balance FROM cash_accounts WHERE factory_id = ?', [factory_id]);
      if (!cash[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Cash account not found', 404); }
      if (parseFloat(cash[0].balance) < parseFloat(amount)) {
        await conn.rollback();
        return fail(res, 'BUSINESS_NEGATIVE_BALANCE', 'Insufficient cash balance');
      }
      await conn.query('UPDATE cash_accounts SET balance = balance - ? WHERE factory_id = ?', [amount, factory_id]);
    } else {
      const [bank] = await conn.query('SELECT balance FROM bank_accounts WHERE id = ? AND factory_id = ?', [bank_id, factory_id]);
      if (!bank[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Bank account not found', 404); }
      if (parseFloat(bank[0].balance) < parseFloat(amount)) {
        await conn.rollback();
        return fail(res, 'BUSINESS_NEGATIVE_BALANCE', 'Insufficient bank balance');
      }
      await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ? AND factory_id = ?', [amount, bank_id, factory_id]);
    }

    const season_id = await getActiveSeasonId(conn, factory_id);

    const [, , result] = await conn.query(
      `INSERT INTO expenses (factory_id, group_id, khata_id, description, amount, payment_method, bank_id, expense_date, created_by, season_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [factory_id, group_id, khata_id, description || null, amount, payment_method,
       bank_id || null, expense_date || new Date().toISOString().slice(0, 10), user_id, season_id]
    );

    await conn.query(
      `INSERT INTO transactions (factory_id, transaction_type, source_type, payment_method, bank_id, amount, notes, season_id)
       VALUES (?, 'OUT', 'SYSTEM', ?, ?, ?, ?, ?)`,
      [factory_id, payment_method, bank_id || null, amount, 'Expense: ' + (description || 'General'), season_id]
    );

    await conn.commit();
    return ok(res, { expense: { id: result.insertId } }, 201);
  } catch (e) {
    await conn.rollback();
    console.error('createExpense error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  } finally {
    conn.release();
  }
};

// DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM expenses WHERE id = ? AND factory_id = ?', [id, factory_id]);
    if (!rows[0]) return fail(res, 'NOT_FOUND', 'Expense not found', 404);
    const exp = rows[0];
    await conn.beginTransaction();
    if (exp.payment_method === 'CASH') {
      await conn.query('UPDATE cash_accounts SET balance = balance + ? WHERE factory_id = ?', [exp.amount, factory_id]);
    } else {
      await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ? AND factory_id = ?', [exp.amount, exp.bank_id, factory_id]);
    }
    await conn.query('DELETE FROM expenses WHERE id = ? AND factory_id = ?', [id, factory_id]);
    await conn.commit();
    return ok(res, { message: 'Expense deleted and balance reversed' });
  } catch (e) {
    await conn.rollback();
    console.error('deleteExpense error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  } finally {
    conn.release();
  }
};

// DELETE /api/expenses/groups/:id  — hard-delete if no transactions, soft-delete otherwise
const deleteGroup = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  try {
    const [existing] = await db.query(
      'SELECT id FROM expense_groups WHERE id = ? AND factory_id = ?', [id, factory_id]
    );
    if (!existing[0]) return fail(res, 'NOT_FOUND', 'Group not found', 404);

    // Check if any expenses reference this group
    const [used] = await db.query(
      'SELECT COUNT(*) AS cnt FROM expenses WHERE group_id = ? AND factory_id = ?', [id, factory_id]
    );
    if (parseInt(used[0].cnt) > 0) {
      // Soft-delete: mark inactive
      await db.query('UPDATE expense_groups SET is_active = false WHERE id = ? AND factory_id = ?', [id, factory_id]);
      // Also soft-delete all khatas under it
      await db.query('UPDATE expense_khatas SET is_active = false WHERE group_id = ? AND factory_id = ?', [id, factory_id]);
    } else {
      // Hard-delete khatas first, then group
      await db.query('DELETE FROM expense_khatas WHERE group_id = ? AND factory_id = ?', [id, factory_id]);
      await db.query('DELETE FROM expense_groups WHERE id = ? AND factory_id = ?', [id, factory_id]);
    }
    return ok(res, { message: 'Group deleted' });
  } catch (e) {
    console.error('deleteGroup error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// DELETE /api/expenses/khatas/:id  — hard-delete if no transactions, soft-delete otherwise
const deleteKhata = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  try {
    const [existing] = await db.query(
      'SELECT id FROM expense_khatas WHERE id = ? AND factory_id = ?', [id, factory_id]
    );
    if (!existing[0]) return fail(res, 'NOT_FOUND', 'Khata not found', 404);

    const [used] = await db.query(
      'SELECT COUNT(*) AS cnt FROM expenses WHERE khata_id = ? AND factory_id = ?', [id, factory_id]
    );
    if (parseInt(used[0].cnt) > 0) {
      await db.query('UPDATE expense_khatas SET is_active = false WHERE id = ? AND factory_id = ?', [id, factory_id]);
    } else {
      await db.query('DELETE FROM expense_khatas WHERE id = ? AND factory_id = ?', [id, factory_id]);
    }
    return ok(res, { message: 'Khata deleted' });
  } catch (e) {
    console.error('deleteKhata error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

module.exports = { getGroups, createGroup, updateGroup, createKhata, updateKhata, getExpenses, createExpense, deleteExpense, deleteGroup, deleteKhata };
