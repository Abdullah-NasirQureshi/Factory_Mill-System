const bcrypt = require('bcrypt');
const db = require('../config/db');
const { ok, fail } = require('../utils/response');

const getUsers = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    'SELECT id, username, role, factory_id, created_at FROM users WHERE factory_id = ? ORDER BY created_at',
    [factory_id]
  );
  return ok(res, { users: rows });
};

const createUser = async (req, res) => {
  const { factory_id } = req.user;
  const { username, password, role } = req.body;
  if (!username || !password || !role)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'username, password and role are required');
  if (!['ADMIN', 'ACCOUNTANT'].includes(role))
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'Role must be ADMIN or ACCOUNTANT');
  if (password.length < 6)
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'Password must be at least 6 characters');

  const [exists] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
  if (exists[0]) return fail(res, 'BUSINESS_DUPLICATE_ENTRY', 'Username already exists');

  const password_hash = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    'INSERT INTO users (factory_id, username, password_hash, role) VALUES (?, ?, ?, ?)',
    [factory_id, username, password_hash, role]
  );
  return ok(res, { user: { id: result.insertId, username, role, factory_id } }, 201);
};

const updateUser = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const { username, password, role } = req.body;

  const [check] = await db.query('SELECT id FROM users WHERE id = ? AND factory_id = ?', [id, factory_id]);
  if (!check[0]) return fail(res, 'NOT_FOUND', 'User not found', 404);

  const updates = [];
  const values = [];
  if (username) { updates.push('username = ?'); values.push(username); }
  if (role) { updates.push('role = ?'); values.push(role); }
  if (password) {
    if (password.length < 6) return fail(res, 'VALIDATION_INVALID_FORMAT', 'Password must be at least 6 characters');
    updates.push('password_hash = ?');
    values.push(await bcrypt.hash(password, 10));
  }
  if (!updates.length) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Nothing to update');

  await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...values, id]);
  return ok(res, { message: 'User updated' });
};

const deleteUser = async (req, res) => {
  const { factory_id, id: selfId } = req.user;
  const { id } = req.params;
  if (parseInt(id) === selfId) return fail(res, 'BUSINESS_CANNOT_DELETE', 'Cannot delete your own account');

  const [check] = await db.query('SELECT id FROM users WHERE id = ? AND factory_id = ?', [id, factory_id]);
  if (!check[0]) return fail(res, 'NOT_FOUND', 'User not found', 404);

  await db.query('DELETE FROM users WHERE id = ?', [id]);
  return ok(res, { message: 'User deleted' });
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
