const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { ok, fail } = require('../utils/response');

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Username and password are required');

  const [rows] = await db.query(
    'SELECT u.*, f.name AS factory_name FROM users u JOIN factories f ON u.factory_id = f.id WHERE u.username = ?',
    [username]
  );
  const user = rows[0];
  if (!user) return fail(res, 'AUTH_INVALID_CREDENTIALS', 'Invalid username or password', 401);

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return fail(res, 'AUTH_INVALID_CREDENTIALS', 'Invalid username or password', 401);

  // Fetch active season
  const [seasonRows] = await db.query(
    'SELECT id, name FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1',
    [user.factory_id]
  );
  const activeSeason = seasonRows[0] || null;

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, factory_id: user.factory_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  return ok(res, {
    token,
    user: {
      id: user.id, username: user.username, role: user.role,
      factory_id: user.factory_id, factory_name: user.factory_name,
      active_season: activeSeason,
    },
  });
};

const me = async (req, res) => {
  const [rows] = await db.query(
    'SELECT u.id, u.username, u.role, u.factory_id, f.name AS factory_name FROM users u JOIN factories f ON u.factory_id = f.id WHERE u.id = ?',
    [req.user.id]
  );
  if (!rows[0]) return fail(res, 'NOT_FOUND', 'User not found', 404);

  const [seasonRows] = await db.query(
    'SELECT id, name FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1',
    [rows[0].factory_id]
  );
  return ok(res, { user: { ...rows[0], active_season: seasonRows[0] || null } });
};

module.exports = { login, me };
