require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5400, user: 'postgres', password: 'Ghotki123', database: 'factory_erp' });

async function run() {
  console.log('\n📊 DATABASE STATE AFTER FULL API TEST\n');

  const checks = [
    ['FACTORIES',           'SELECT id, name, address, phone FROM factories'],
    ['USERS',               'SELECT id, username, role, factory_id FROM users ORDER BY id'],
    ['SETTINGS',            'SELECT factory_id, company_name, phone, address FROM settings'],
    ['BAG_WEIGHTS',         'SELECT id, weight_value, unit FROM bag_weights ORDER BY weight_value::numeric'],
    ['DOCUMENT_SEQUENCES',  'SELECT factory_id, document_type, last_sequence FROM document_sequences ORDER BY document_type'],
    ['CASH_ACCOUNTS',       'SELECT factory_id, balance FROM cash_accounts'],
    ['BANK_ACCOUNTS',       'SELECT id, bank_name, account_title, balance, is_deleted FROM bank_accounts ORDER BY id'],
    ['PRODUCTS',            'SELECT id, name, status FROM products ORDER BY id'],
    ['INVENTORY',           `SELECT i.id, p.name AS product, bw.weight_value AS weight, i.quantity
                             FROM inventory i
                             JOIN products p ON p.id = i.product_id
                             JOIN bag_weights bw ON bw.id = i.weight_id
                             ORDER BY i.id`],
    ['CUSTOMERS',           'SELECT id, name, phone, is_deleted FROM customers ORDER BY id'],
    ['SUPPLIERS',           'SELECT id, name, phone, is_deleted FROM suppliers ORDER BY id'],
    ['SALES',               'SELECT id, invoice_number, total_amount, paid_amount, remaining_amount, status FROM sales ORDER BY id'],
    ['PURCHASES',           'SELECT id, invoice_number, total_amount, paid_amount, remaining_amount, status FROM purchases ORDER BY id'],
    ['PAYMENTS',            'SELECT id, voucher_number, type, amount, payment_method, status FROM payments ORDER BY id'],
    ['PAYMENT_ALLOCATIONS', 'SELECT id, payment_id, reference_type, reference_id, allocated_amount FROM payment_allocations ORDER BY id'],
    ['TRANSACTIONS',        'SELECT id, transaction_type, source_type, payment_method, amount FROM transactions ORDER BY id'],
    ['STOCK_TRANSACTIONS',  'SELECT id, type, quantity, note FROM stock_transactions ORDER BY id'],
  ];

  for (const [label, sql] of checks) {
    const r = await pool.query(sql);
    console.log(`\n=== ${label} (${r.rows.length} rows) ===`);
    if (r.rows.length) console.table(r.rows);
    else console.log('  (empty)');
  }

  // ── Integrity checks ──────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log('🔍 INTEGRITY CHECKS');
  console.log('═'.repeat(55));

  const cash = await pool.query('SELECT balance FROM cash_accounts WHERE factory_id = 1');
  console.log('  Cash balance:              ', cash.rows[0]?.balance);

  const salesOut = await pool.query("SELECT COALESCE(SUM(remaining_amount),0) AS total FROM sales WHERE status = 'ACTIVE'");
  console.log('  Total outstanding (sales): ', salesOut.rows[0]?.total);

  const purchOut = await pool.query("SELECT COALESCE(SUM(remaining_amount),0) AS total FROM purchases WHERE status = 'ACTIVE'");
  console.log('  Total payable (purchases): ', purchOut.rows[0]?.total);

  const txSummary = await pool.query(`
    SELECT COUNT(*) AS count,
           COALESCE(SUM(CASE WHEN transaction_type = 'IN'  THEN amount ELSE 0 END), 0) AS total_in,
           COALESCE(SUM(CASE WHEN transaction_type = 'OUT' THEN amount ELSE 0 END), 0) AS total_out
    FROM transactions WHERE is_deleted = FALSE
  `);
  const tx = txSummary.rows[0];
  console.log(`  Transactions — count: ${tx.count} | IN: ${tx.total_in} | OUT: ${tx.total_out}`);

  const invCheck = await pool.query(`
    SELECT p.name, bw.weight_value, i.quantity
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN bag_weights bw ON bw.id = i.weight_id
    WHERE i.quantity < 0
  `);
  if (invCheck.rows.length === 0) console.log('  Negative inventory:        NONE ✅');
  else { console.log('  ❌ NEGATIVE INVENTORY FOUND:'); console.table(invCheck.rows); }

  const orphanAllocs = await pool.query(`
    SELECT pa.id FROM payment_allocations pa
    LEFT JOIN payments p ON p.id = pa.payment_id
    WHERE p.id IS NULL
  `);
  if (orphanAllocs.rows.length === 0) console.log('  Orphan allocations:        NONE ✅');
  else console.log('  ❌ ORPHAN ALLOCATIONS:', orphanAllocs.rows.length);

  console.log('═'.repeat(55));
  console.log('\n✅ Database check complete\n');
  await pool.end();
}

run().catch(e => { console.error('ERROR:', e.message); pool.end(); });
