/**
 * Allocates a payment amount to outstanding records (sales or purchases)
 * oldest-first. Marks records as fully paid when remaining reaches 0.
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
  // fetch unpaid records oldest first
  const [records] = await conn.query(
    `SELECT id, remaining_amount FROM ${table}
     WHERE ${ownerField} = ? AND factory_id = ? AND status = 'ACTIVE' AND remaining_amount > 0
     ORDER BY created_at ASC FOR UPDATE`,
    [ownerId, factory_id]
  );

  let remaining = parseFloat(amount);
  const allocations = [];

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
