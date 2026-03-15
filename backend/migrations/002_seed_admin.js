require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/config/db');

async function seed() {
  // 1. Insert factory
  const [fResult] = await db.query(
    `INSERT INTO factories (name, address, phone) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = name`,
    ['Main Factory', 'Factory Address', '0300-0000000']
  );
  const factoryId = fResult.insertId || 1;

  // 2. Insert settings row
  await db.query(
    `INSERT IGNORE INTO settings (factory_id, company_name, invoice_footer)
     VALUES (?, ?, ?)`,
    [factoryId, 'Main Factory', 'Thank you for your business!']
  );

  // 3. Insert cash account
  await db.query(
    `INSERT IGNORE INTO cash_accounts (factory_id, balance) VALUES (?, 0)`,
    [factoryId]
  );

  // 4. Seed document sequences for all types
  for (const type of ['SI', 'PI', 'PV', 'JV']) {
    await db.query(
      `INSERT IGNORE INTO document_sequences (factory_id, document_type, last_sequence) VALUES (?, ?, 0)`,
      [factoryId, type]
    );
  }

  // 5. Insert admin user
  const hash = await bcrypt.hash('admin123', 10);
  await db.query(
    `INSERT INTO users (factory_id, username, password_hash, role) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE username = username`,
    [factoryId, 'admin', hash, 'ADMIN']
  );

  // 6. Insert accountant user
  const hash2 = await bcrypt.hash('acc123', 10);
  await db.query(
    `INSERT INTO users (factory_id, username, password_hash, role) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE username = username`,
    [factoryId, 'accountant', hash2, 'ACCOUNTANT']
  );

  console.log('✅ Seed complete');
  console.log('   Factory ID:', factoryId);
  console.log('   Admin login     → username: admin      password: admin123');
  console.log('   Accountant login→ username: accountant password: acc123');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
