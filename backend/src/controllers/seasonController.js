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
     LEFT JOIN customers c  ON ob.entity_type = 'CUSTOMER' AND c.id  = ob.entity_id
     LEFT JOIN suppliers s  ON ob.entity_type = 'SUPPLIER' AND s.id  = ob.entity_id
     LEFT JOIN employees e  ON ob.entity_type = 'EMPLOYEE' AND e.id  = ob.entity_id
     LEFT JOIN bank_accounts b ON ob.entity_type = 'BANK'  AND b.id  = ob.entity_id
     WHERE ob.season_id = ? AND ob.factory_id = ?
     ORDER BY ob.entity_type, ob.entity_id`,
    [id, factory_id]
  );
  return ok(res, { opening_balances: rows });
};

// ─────────────────────────────────────────
// POST /api/seasons/close  — ADMIN only
// Closes current season, snapshots balances, creates new season
// ─────────────────────────────────────────
const closeSeason = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { new_season_name } = req.body;

  if (!new_season_name || !new_season_name.trim())
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'new_season_name is required');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Get current active season
    const [activeRows] = await conn.query(
      'SELECT * FROM seasons WHERE factory_id = ? AND is_active = TRUE FOR UPDATE',
      [factory_id]
    );
    if (!activeRows[0]) {
      await conn.rollback();
      return fail(res, 'NOT_FOUND', 'No active season found', 404);
    }
    const currentSeason = activeRows[0];

    // ── 2. Snapshot closing balances ──────────────────────────────

    // 2a. Customers — sum of remaining_amount on active unpaid sales
    const [customers] = await conn.query(
      `SELECT customer_id AS entity_id, SUM(remaining_amount) AS balance
       FROM sales
       WHERE factory_id = ? AND season_id = ? AND status = 'ACTIVE' AND is_deleted = FALSE AND remaining_amount > 0
       GROUP BY customer_id`,
      [factory_id, currentSeason.id]
    );

    // 2b. Suppliers — sum of remaining_amount on active unpaid purchases
    const [suppliers] = await conn.query(
      `SELECT supplier_id AS entity_id, SUM(remaining_amount) AS balance
       FROM purchases
       WHERE factory_id = ? AND season_id = ? AND status = 'ACTIVE' AND is_deleted = FALSE AND remaining_amount > 0
       GROUP BY supplier_id`,
      [factory_id, currentSeason.id]
    );

    // 2c. Employees — outstanding from khata (CREDIT - DEBIT)
    const [employees] = await conn.query(
      `SELECT employee_id AS entity_id,
              SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) AS balance
       FROM employee_khata_entries
       WHERE factory_id = ? AND season_id = ?
       GROUP BY employee_id
       HAVING SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) != 0`,
      [factory_id, currentSeason.id]
    );

    // 2d. Banks — current balance
    const [banks] = await conn.query(
      'SELECT id AS entity_id, balance FROM bank_accounts WHERE factory_id = ? AND is_deleted = FALSE',
      [factory_id]
    );

    // 2e. Cash — current balance
    const [cash] = await conn.query(
      'SELECT balance FROM cash_accounts WHERE factory_id = ?',
      [factory_id]
    );

    // 3. Close current season
    await conn.query(
      `UPDATE seasons SET is_active = FALSE, end_date = CURRENT_DATE, closed_at = NOW(), closed_by = ?
       WHERE id = ?`,
      [user_id, currentSeason.id]
    );

    // 4. Create new season
    const [newSeasonRows] = await conn.query(
      `INSERT INTO seasons (factory_id, name, start_date, is_active) VALUES (?, ?, CURRENT_DATE, TRUE)`,
      [factory_id, new_season_name.trim()]
    );
    const newSeasonId = newSeasonRows[0]?.id || newSeasonRows.insertId;

    // 5. Insert opening balances for new season
    const insertOB = async (type, rows, idField = 'entity_id') => {
      for (const row of rows) {
        const bal = parseFloat(row.balance);
        if (!bal || bal === 0) continue;
        await conn.query(
          `INSERT INTO season_opening_balances (season_id, factory_id, entity_type, entity_id, balance)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (season_id, entity_type, entity_id) DO UPDATE SET balance = EXCLUDED.balance`,
          [newSeasonId, factory_id, type, row[idField], bal]
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

    // 6. Reset document sequences for new season
    await conn.query(
      `UPDATE document_sequences SET last_sequence = 0 WHERE factory_id = ?`,
      [factory_id]
    );

    // 7. Inventory carries forward automatically (no reset needed)
    // stock_transactions for new season will start fresh via season_id scoping

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

module.exports = { listSeasons, getActiveSeason, getOpeningBalances, closeSeason };
