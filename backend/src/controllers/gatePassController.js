const db = require('../config/db');
const { ok, fail } = require('../utils/response');
const { nextDocNumber } = require('../utils/docNumber');
const { getActiveSeasonId } = require('../utils/activeSeason');

const getGatePasses = async (req, res) => {
  const { factory_id } = req.user;
  const { from, to, type, search } = req.query;

  const [seasonRows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
  );
  const season_id = seasonRows[0]?.id || null;

  let q = `SELECT gp.*, u.username AS created_by_name
           FROM gate_passes gp
           JOIN users u ON u.id = gp.created_by
           WHERE gp.factory_id = ?`;
  const params = [factory_id];

  if (season_id) { q += ' AND gp.season_id = ?'; params.push(season_id); }
  if (from)   { q += ' AND gp.pass_date >= ?'; params.push(from); }
  if (to)     { q += ' AND gp.pass_date <= ?'; params.push(to + ' 23:59:59'); }
  if (type)   { q += ' AND gp.pass_type = ?'; params.push(type); }
  if (search) { q += ' AND (gp.party_name ILIKE ? OR gp.vehicle_number ILIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  q += ' ORDER BY gp.pass_date DESC';

  const [rows] = await db.query(q, params);
  return ok(res, { gate_passes: rows });
};

const getGatePass = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    'SELECT gp.*, u.username AS created_by_name FROM gate_passes gp JOIN users u ON u.id = gp.created_by WHERE gp.id = ? AND gp.factory_id = ?',
    [req.params.id, factory_id]
  );
  if (!rows[0]) return fail(res, 'NOT_FOUND', 'Gate pass not found', 404);
  return ok(res, { gate_pass: rows[0] });
};

const createGatePass = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { pass_type, vehicle_number, driver_name, driver_phone, party_type, party_name, description, pass_date } = req.body;

  if (!pass_type || !party_type || !party_name)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'pass_type, party_type, party_name are required');
  if (!['IN','OUT'].includes(pass_type))
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'pass_type must be IN or OUT');
  if (!['CUSTOMER','SUPPLIER','OTHER'].includes(party_type))
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'party_type must be CUSTOMER, SUPPLIER, or OTHER');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const gp = await nextDocNumber(conn, factory_id, 'GP');
    const season_id = await getActiveSeasonId(conn, factory_id);
    const [result] = await conn.query(
      `INSERT INTO gate_passes (factory_id, gp_number, pass_type, vehicle_number, driver_name, driver_phone, party_type, party_name, description, pass_date, created_by, season_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [factory_id, gp, pass_type, vehicle_number || null, driver_name || null, driver_phone || null,
       party_type, party_name, description || null, pass_date || new Date(), user_id, season_id]
    );
    await conn.commit();
    return ok(res, { gate_pass: { id: result.insertId, gp_number: gp } }, 201);
  } catch (e) {
    await conn.rollback();
    return fail(res, 'SERVER_ERROR', e.message, 500);
  } finally {
    conn.release();
  }
};

const deleteGatePass = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query('SELECT id FROM gate_passes WHERE id = ? AND factory_id = ?', [req.params.id, factory_id]);
  if (!rows[0]) return fail(res, 'NOT_FOUND', 'Gate pass not found', 404);
  await db.query('DELETE FROM gate_passes WHERE id = ?', [req.params.id]);
  return ok(res, { message: 'Gate pass deleted' });
};

module.exports = { getGatePasses, getGatePass, createGatePass, deleteGatePass };
