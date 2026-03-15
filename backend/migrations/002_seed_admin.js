require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/config/db');

async function seed() {
  // 1. Insert factory
  const [fRows] = await db.query(
    `INSERT INTO factories (name, address, phone) VALUES (?, ?, ?)
     ON CONFLICT DO NOTHING RETURNING id`,
    ['Main Factory', 'Factory Address', '0300-0000000']
  );
  let factoryId = fRows[0]?.id;
  if (!factoryId) {
    const [existing] = await db.query("SELECT id FROM factories WHERE name = 'Main Factory' LIMIT 1");
    factoryId = existing[0]?.id || 1;
  }

  // 2. Insert settings row
  await db.query(
    `INSERT INTO settings (factory_id, company_name, invoice_footer)
     VALUES (?, ?, ?)
     ON CONFLICT (factory_id) DO NOTHING`,
    [factoryId, 'Main Factory', 'Thank you for your business!']
  );

  // 3. Insert cash account
  await db.query(
    `INSERT INTO cash_accounts (factory_id, balance) VALUES (?, 0)
     ON CONFLICT (factory_id) DO NOTHING`,
    [factoryId]
  );

  // 4. Seed document sequences for all types
  for (const type of ['SI', 'PI', 'PV', 'JV']) {
    await db.query(
      `INSERT INTO document_sequences (factory_id, document_type, last_sequence) VALUES (?, ?, 0)
       ON CONFLICT (factory_id, document_type) DO NOTHING`,
      [factoryId, type]
    );
  }

  // 5. Insert admin user
  const hash = await bcrypt.hash('admin123', 10);
  await db.query(
    `INSERT INTO users (factory_id, username, password_hash, role) VALUES (?, ?, ?, ?)
     ON CONFLICT (username) DO NOTHING`,
    [factoryId, 'admin', hash, 'ADMIN']
  );

  // 6. Insert accountant user
  const hash2 = await bcrypt.hash('acc123', 10);
  await db.query(
    `INSERT INTO users (factory_id, username, password_hash, role) VALUES (?, ?, ?, ?)
     ON CONFLICT (username) DO NOTHING`,
    [factoryId, 'accountant', hash2, 'ACCOUNTANT']
  );

  console.log('✅ Seed complete');
  console.log('   Factory ID:', factoryId);
  console.log('   Admin login     → username: admin      password: admin123');
  console.log('   Accountant login→ username: accountant password: acc123');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
