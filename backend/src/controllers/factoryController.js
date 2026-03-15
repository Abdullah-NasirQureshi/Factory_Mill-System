const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// GET /api/settings  — returns settings for the user's factory
const getSettings = async (req, res) => {
  const factory_id = req.user.factory_id;
  const [rows] = await db.query(
    'SELECT s.*, f.name AS factory_name, f.address AS factory_address, f.phone AS factory_phone FROM settings s JOIN factories f ON s.factory_id = f.id WHERE s.factory_id = ?',
    [factory_id]
  );
  return ok(res, { settings: rows[0] || null });
};

// PUT /api/settings  — admin only
const updateSettings = async (req, res) => {
  const factory_id = req.user.factory_id;
  const { company_name, address, phone, invoice_footer } = req.body;
  const logo = req.file ? req.file.filename : undefined;

  // upsert settings row
  const fields = { company_name, address, phone, invoice_footer };
  if (logo) fields.company_logo = logo;

  const setClauses = Object.keys(fields)
    .filter((k) => fields[k] !== undefined)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.keys(fields)
    .filter((k) => fields[k] !== undefined)
    .map((k) => fields[k]);

  if (!setClauses) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'No fields to update');

  const filteredKeys = Object.keys(fields).filter((k) => fields[k] !== undefined);
  await db.query(
    `INSERT INTO settings (factory_id, ${filteredKeys.join(', ')})
     VALUES (?, ${values.map(() => '?').join(', ')})
     ON CONFLICT (factory_id) DO UPDATE SET ${setClauses}`,
    [factory_id, ...values, ...values]
  );

  // also update factory name/address/phone if provided
  if (company_name || address || phone) {
    const fFields = {};
    if (company_name) fFields.name = company_name;
    if (address) fFields.address = address;
    if (phone) fFields.phone = phone;
    const fSet = Object.keys(fFields).map((k) => `${k} = ?`).join(', ');
    await db.query(`UPDATE factories SET ${fSet} WHERE id = ?`, [...Object.values(fFields), factory_id]);
  }

  const [updated] = await db.query(
    'SELECT s.*, f.name AS factory_name FROM settings s JOIN factories f ON s.factory_id = f.id WHERE s.factory_id = ?',
    [factory_id]
  );
  return ok(res, { settings: updated[0] });
};

module.exports = { getSettings, updateSettings };
