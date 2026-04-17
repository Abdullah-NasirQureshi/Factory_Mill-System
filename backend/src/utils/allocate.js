/**
 * Allocates a payment amount to outstanding records (sales or purchases)
 * oldest-first. Also reduces the season opening balance if present.
 *
 * @param {object} conn         - DB connection inside a transaction
 * @param {'SALE'|'PURCHASE'}   referenceType
 * @param {string} table        - 'sales' or 'purchases'
 * @param {number} ownerId      - customer_id or supplier_id
 * @param {string} ownerField   - 'customer_id' or 'supplier_id'
 * @param {number} factory_id
 * @param {number} payment_id
 * @param {number} amount       - total payment amount to allocate
 * @returns {Array}             - allocation records created
 */
async function allocatePayment(conn, referenceType, table, ownerId, ownerField, factory_id, payment_id, amount) {
  let remaining = parseFloat(amount);
  const allocations = [];

  // ── Step 1: Reduce opening balance first (if any) ──────────────────────────
  const entityType = referenceType === 'SALE' ? 'CUSTOMER' : 'SUPPLIER';
  const [seasonRows] = await conn.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1',
    [factory_id]
  );
  const season_id = seasonRows[0]?.id || null;

  if (season_id) {
    const [obRows] = await conn.query(
      `SELECT id, balance FROM season_opening_balances
       WHERE entity_type = ? AND entity_id = ? AND season_id = ? AND balance > 0
       FOR UPDATE`,
      [entityType, ownerId, season_id]
    );
    if (obRows[0] && remaining > 0) {
      const obBalance = parseFloat(obRows[0].balance);
      const deduct = Math.min(remaining, obBalance);
      const newBalance = Math.round((obBalance - deduct) * 100) / 100;
      await conn.query(
        'UPDATE season_opening_balances SET balance = ? WHERE id = ?',
        [newBalance, obRows[0].id]
      );
      remaining = Math.round((remaining - deduct) * 100) / 100;
    }
  }

  if (remaining <= 0) return allocations;

  // ── Step 2: Allocate to current season invoices oldest-first ───────────────
  const [records] = await conn.query(
    `SELECT id, remaining_amount FROM ${table}
     WHERE ${ownerField} = ? AND factory_id = ? AND status = 'ACTIVE' AND remaining_amount > 0
     ORDER BY created_at ASC FOR UPDATE`,
    [ownerId, factory_id]
  );

  for (const record of records) {
    if (remaining <= 0) break;
    const recordRemaining = parseFloat(record.remaining_amount);
    const allocated = Math.min(remaining, recordRemaining);
    const newRemaining = Math.round((recordRemaining - allocated) * 100) / 100;

    await conn.query(
      `UPDATE ${table} SET paid_amount = paid_amount + ?, remaining_amount = ? WHERE id = ?`,
      [allocated, newRemaining, record.id]
    );

    await conn.query(
      `INSERT INTO payment_allocations (payment_id, reference_type, reference_id, allocated_amount)
       VALUES (?, ?, ?, ?)`,
      [payment_id, referenceType, record.id, allocated]
    );

    allocations.push({ reference_id: record.id, allocated_amount: allocated });
    remaining = Math.round((remaining - allocated) * 100) / 100;
  }

  return allocations;
}

module.exports = { allocatePayment };
