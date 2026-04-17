/**
 * reset_db.js
 * Clears all operational data and reseeds admin + accountant users.
 * Run: node migrations/reset_db.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/config/db');

async function reset() {
  console.log('⚠️  Resetting database...');

  // Delete in reverse dependency order
  const tables = [
    'payment_allocations',
    'payments',
    'stock_transactions',
    'sale_items',
    'sales',
    'purchase_items',
    'purchases',
    'inventory',
    'employee_salary_payments',
    'employee_khata_entries',
    'employees',
    'expenses',
    'expense_khatas',
    'expense_groups',
    'gate_passes',
    'transactions',
    'bank_accounts',
    'cash_accounts',
    'customers',
    'suppliers',
    'products',
    'document_sequences',
    'settings',
    'users',
    'factories',
  ];

  for (const table of tables) {
    await db.query(`DELETE FROM ${table}`);
    // Reset sequences
    await db.query(`ALTER SEQUENCE IF EXISTS ${table}_id_seq RESTART WITH 1`);
    console.log(`  ✓ Cleared ${table}`);
  }

  // Re-seed factory
  const [fRows] = await db.query(
    `INSERT INTO factories (name, address, phone) VALUES (?, ?, ?) RETURNING id`,
    ['Main Factory', 'Factory Address', '0300-0000000']
  );
  const factoryId = fRows[0].id;

  // Re-seed settings
  await db.query(
    `INSERT INTO settings (factory_id, company_name, invoice_footer) VALUES (?, ?, ?)`,
    [factoryId, 'Main Factory', 'Thank you for your business!']
  );

  // Re-seed cash account
  await db.query(
    `INSERT INTO cash_accounts (factory_id, balance) VALUES (?, 0)`,
    [factoryId]
  );

  // Re-seed document sequences
  for (const type of ['SI', 'PI', 'PV', 'JV', 'GP']) {
    await db.query(
      `INSERT INTO document_sequences (factory_id, document_type, last_sequence) VALUES (?, ?, 0)`,
      [factoryId, type]
    );
  }

  // Re-seed admin
  const adminHash = await bcrypt.hash('admin123', 10);
  await db.query(
    `INSERT INTO users (factory_id, username, password_hash, role) VALUES (?, ?, ?, ?)`,
    [factoryId, 'admin', adminHash, 'ADMIN']
  );

  // Re-seed accountant
  const accHash = await bcrypt.hash('acc123', 10);
  await db.query(
    `INSERT INTO users (factory_id, username, password_hash, role) VALUES (?, ?, ?, ?)`,
    [factoryId, 'accountant', accHash, 'ACCOUNTANT']
  );

  console.log('\n✅ Reset complete');
  console.log('   Admin      → username: admin       password: admin123');
  console.log('   Accountant → username: accountant  password: acc123');
  process.exit(0);
}

reset().catch((e) => { console.error(e); process.exit(1); });
