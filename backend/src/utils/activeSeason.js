const db = require('../config/db');

/**
 * Returns the active season_id for a factory.
 * Throws if no active season exists.
 * @param {object} conn - db connection or pool
 * @param {number} factory_id
 * @returns {number} season_id
 */
async function getActiveSeasonId(conn, factory_id) {
  const [rows] = await conn.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1',
    [factory_id]
  );
  if (!rows[0]) throw new Error('No active season found. Please contact your administrator.');
  return rows[0].id;
}

module.exports = { getActiveSeasonId };
