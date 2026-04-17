const db = require('../config/db');
const { ok, fail } = require('../utils/response');

// ─────────────────────────────────────────
// GET /api/seasons  — list all seasons for factory
// ─────────────────────────────────────────
const listSeasons = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    `SELECT s.*, u.username AS closed_by_name
     FROM seasons s
     LEFT JOIN users u ON u.id = s.closed_by
     WHERE s.factory_id = ?
     ORDER BY s.id DESC`,
    [factory_id]
  );
  return ok(res, { seasons: rows });
};

// ─────────────────────────────────────────
// GET /api/seasons/active  — get current active season
// ─────────────────────────────────────────
const getActiveSeason = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    'SELECT * FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1',
    [factory_id]
  );
  if (!rows[0]) return fail(res, 'NOT_FOUND', 'No active season found', 404);
  return ok(res, { season: rows[0] });
};

// ─────────────────────────────────────────
// GET /api/seasons/:id/opening-balances
// ─────────────────────────────────────────
const getOpeningBalances = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;

  const [season] = await db.query(
    'SELECT id FROM seasons WHERE id = ? AND factory_id = ?',
    [id, factory_id]
  );
  if (!season[0]) return fail(res, 'NOT_FOUND', 'Season not found', 404);

  const [rows] = await db.query(
    `SELECT ob.*,
      CASE
        WHEN ob.entity_type = 'CUSTOMER' THEN c.name
        WHEN ob.entity_type = 'SUPPLIER' THEN s.name
        WHEN ob.entity_type = 'EMPLOYEE' THEN e.name
        WHEN ob.entity_type = 'BANK'     THEN b.bank_name || ' - ' || b.account_title
        ELSE 'Cash'
      END AS entity_name
     FROM season_opening_balances ob
     LEFT JOIN customers c    ON ob.entity_type = 'CUSTOMER' AND c.id = ob.entity_id
     LEFT JOIN suppliers s    ON ob.entity_type = 'SUPPLIER' AND s.id = ob.entity_id
     LEFT JOIN employees e    ON ob.entity_type = 'EMPLOYEE' AND e.id = ob.entity_id
     LEFT JOIN bank_accounts b ON ob.entity_type = 'BANK'    AND b.id = ob.entity_id
     WHERE ob.season_id = ? AND ob.factory_id = ?
     ORDER BY ob.entity_type, ob.entity_id`,
    [id, factory_id]
  );
  return ok(res, { opening_balances: rows });
};

// ─────────────────────────────────────────
// GET /api/seasons/active/opening-balances/entities
// Returns all customers, suppliers, employees with their current OB for the active season
// Used by the OB editor UI
// ─────────────────────────────────────────
const getOpeningBalanceEntities = async (req, res) => {
  const { factory_id } = req.user;

  const [seasonRows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1',
    [factory_id]
  );
  if (!seasonRows[0]) return fail(res, 'NOT_FOUND', 'No active season found', 404);
  const season_id = seasonRows[0].id;

  const [[customers], [suppliers], [employees]] = await Promise.all([
    db.query(
      `SELECT c.id, c.name, c.phone,
              COALESCE(ob.balance, 0) AS opening_balance
       FROM customers c
       LEFT JOIN season_opening_balances ob
         ON ob.entity_type = 'CUSTOMER' AND ob.entity_id = c.id AND ob.season_id = ?
       WHERE c.factory_id = ? AND c.is_deleted = FALSE
       ORDER BY c.name`,
      [season_id, factory_id]
    ),
    db.query(
      `SELECT s.id, s.name, s.phone,
              COALESCE(ob.balance, 0) AS opening_balance
       FROM suppliers s
       LEFT JOIN season_opening_balances ob
         ON ob.entity_type = 'SUPPLIER' AND ob.entity_id = s.id AND ob.season_id = ?
       WHERE s.factory_id = ? AND s.is_deleted = FALSE
       ORDER BY s.name`,
      [season_id, factory_id]
    ),
    db.query(
      `SELECT e.id, e.name, e.phone,
              COALESCE(ob.balance, 0) AS opening_balance
       FROM employees e
       LEFT JOIN season_opening_balances ob
         ON ob.entity_type = 'EMPLOYEE' AND ob.entity_id = e.id AND ob.season_id = ?
       WHERE e.factory_id = ? AND e.is_active = TRUE
       ORDER BY e.name`,
      [season_id, factory_id]
    ),
  ]);

  return ok(res, { season_id, customers, suppliers, employees });
};

// ─────────────────────────────────────────
// PUT /api/seasons/active/opening-balances  — ADMIN only
// Bulk upsert opening balances for the active season.
// Body: { entries: [{ entity_type, entity_id, balance }] }
// balance > 0 = they owe us (customer receivable / supplier payable we owe)
// balance = 0 removes the entry
// ─────────────────────────────────────────
const upsertOpeningBalances = async (req, res) => {
  const { factory_id } = req.user;
  const { entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'entries array is required');

  const [seasonRows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1',
    [factory_id]
  );
  if (!seasonRows[0]) return fail(res, 'NOT_FOUND', 'No active season found', 404);
  const season_id = seasonRows[0].id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const entry of entries) {
      const { entity_type, entity_id, balance } = entry;
      if (!['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'BANK', 'CASH'].includes(entity_type))
        continue;

      const bal = parseFloat(balance) || 0;

      if (bal === 0) {
        // Remove the entry if balance is zero
        await conn.query(
          `DELETE FROM season_opening_balances
           WHERE season_id = ? AND factory_id = ? AND entity_type = ? AND entity_id = ?`,
          [season_id, factory_id, entity_type, entity_id]
        );
      } else {
        await conn.query(
          `INSERT INTO season_opening_balances (season_id, factory_id, entity_type, entity_id, balance)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (season_id, entity_type, entity_id)
           DO UPDATE SET balance = EXCLUDED.balance`,
          [season_id, factory_id, entity_type, entity_id, bal]
        );
      }
    }

    await conn.commit();
    return ok(res, { message: 'Opening balances saved successfully' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────
// POST /api/seasons/close  — ADMIN only
// ─────────────────────────────────────────
const closeSeason = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { new_season_name } = req.body;

  if (!new_season_name || !new_season_name.trim())
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'new_season_name is required');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [activeRows] = await conn.query(
      'SELECT * FROM seasons WHERE factory_id = ? AND is_active = TRUE FOR UPDATE',
      [factory_id]
    );
    if (!activeRows[0]) {
      await conn.rollback();
      return fail(res, 'NOT_FOUND', 'No active season found', 404);
    }
    const currentSeason = activeRows[0];

    // Snapshot closing balances — current season sales + opening balance carried in
    const [customers] = await conn.query(
      `SELECT entity_id, SUM(bal) AS balance FROM (
         SELECT customer_id AS entity_id, SUM(remaining_amount) AS bal
         FROM sales
         WHERE factory_id = ? AND season_id = ? AND status = 'ACTIVE' AND is_deleted = FALSE AND remaining_amount > 0
         GROUP BY customer_id
         UNION ALL
         SELECT entity_id, balance AS bal
         FROM season_opening_balances
         WHERE factory_id = ? AND season_id = ? AND entity_type = 'CUSTOMER'
       ) t GROUP BY entity_id`,
      [factory_id, currentSeason.id, factory_id, currentSeason.id]
    );

    const [suppliers] = await conn.query(
      `SELECT entity_id, SUM(bal) AS balance FROM (
         SELECT supplier_id AS entity_id, SUM(remaining_amount) AS bal
         FROM purchases
         WHERE factory_id = ? AND season_id = ? AND status = 'ACTIVE' AND is_deleted = FALSE AND remaining_amount > 0
         GROUP BY supplier_id
         UNION ALL
         SELECT entity_id, balance AS bal
         FROM season_opening_balances
         WHERE factory_id = ? AND season_id = ? AND entity_type = 'SUPPLIER'
       ) t GROUP BY entity_id`,
      [factory_id, currentSeason.id, factory_id, currentSeason.id]
    );

    const [employees] = await conn.query(
      `SELECT entity_id, SUM(bal) AS balance FROM (
         SELECT employee_id AS entity_id,
                SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) AS bal
         FROM employee_khata_entries
         WHERE factory_id = ? AND season_id = ?
         GROUP BY employee_id
         UNION ALL
         SELECT entity_id, balance AS bal
         FROM season_opening_balances
         WHERE factory_id = ? AND season_id = ? AND entity_type = 'EMPLOYEE'
       ) t GROUP BY entity_id`,
      [factory_id, currentSeason.id, factory_id, currentSeason.id]
    );

    const [banks] = await conn.query(
      'SELECT id AS entity_id, balance FROM bank_accounts WHERE factory_id = ? AND is_deleted = FALSE',
      [factory_id]
    );

    const [cash] = await conn.query(
      'SELECT balance FROM cash_accounts WHERE factory_id = ?',
      [factory_id]
    );

    // Close current season
    await conn.query(
      `UPDATE seasons SET is_active = FALSE, end_date = CURRENT_DATE, closed_at = NOW(), closed_by = ?
       WHERE id = ?`,
      [user_id, currentSeason.id]
    );

    // Create new season
    const [newSeasonRows] = await conn.query(
      `INSERT INTO seasons (factory_id, name, start_date, is_active) VALUES (?, ?, CURRENT_DATE, TRUE)`,
      [factory_id, new_season_name.trim()]
    );
    const newSeasonId = newSeasonRows[0]?.id || newSeasonRows.insertId;

    // Insert opening balances for new season
    const insertOB = async (type, rows) => {
      for (const row of rows) {
        const bal = parseFloat(row.balance);
        if (!bal || bal === 0) continue;
        await conn.query(
          `INSERT INTO season_opening_balances (season_id, factory_id, entity_type, entity_id, balance)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (season_id, entity_type, entity_id) DO UPDATE SET balance = EXCLUDED.balance`,
          [newSeasonId, factory_id, type, row.entity_id, bal]
        );
      }
    };

    await insertOB('CUSTOMER', customers);
    await insertOB('SUPPLIER', suppliers);
    await insertOB('EMPLOYEE', employees);
    await insertOB('BANK', banks);
    if (cash[0] && parseFloat(cash[0].balance) !== 0) {
      await conn.query(
        `INSERT INTO season_opening_balances (season_id, factory_id, entity_type, entity_id, balance)
         VALUES (?, ?, 'CASH', ?, ?)
         ON CONFLICT (season_id, entity_type, entity_id) DO UPDATE SET balance = EXCLUDED.balance`,
        [newSeasonId, factory_id, factory_id, parseFloat(cash[0].balance)]
      );
    }

    // Reset document sequences
    await conn.query(
      `UPDATE document_sequences SET last_sequence = 0 WHERE factory_id = ?`,
      [factory_id]
    );

    await conn.commit();

    const [newSeason] = await db.query('SELECT * FROM seasons WHERE id = ?', [newSeasonId]);
    return ok(res, {
      message: `Season "${currentSeason.name}" closed. "${new_season_name.trim()}" is now active.`,
      closed_season: currentSeason,
      new_season: newSeason[0],
    }, 201);

  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { listSeasons, getActiveSeason, getOpeningBalances, getOpeningBalanceEntities, upsertOpeningBalances, closeSeason };

