const db = require('../config/db');

/**
 * Generates next document number for a factory + type.
 * Uses row-level locking to prevent duplicates under concurrency.
 * @param {object} conn       - active DB connection (inside a transaction)
 * @param {number} factory_id
 * @param {'SI'|'PI'|'PV'|'JV'|'GP'} type
 * @returns {string}  e.g. "SI-00001"
 */
async function nextDocNumber(conn, factory_id, type) {
  // lock the row
  const [rows] = await conn.query(
    'SELECT last_sequence FROM document_sequences WHERE factory_id = ? AND document_type = ? FOR UPDATE',
    [factory_id, type]
  );

  let seq = 1;
  if (rows.length === 0) {
    await conn.query(
      'INSERT INTO document_sequences (factory_id, document_type, last_sequence) VALUES (?, ?, 1)',
      [factory_id, type]
    );
  } else {
    seq = rows[0].last_sequence + 1;
    await conn.query(
      'UPDATE document_sequences SET last_sequence = ? WHERE factory_id = ? AND document_type = ?',
      [seq, factory_id, type]
    );
  }

  return `${type}-${String(seq).padStart(5, '0')}`;
}

module.exports = { nextDocNumber };
