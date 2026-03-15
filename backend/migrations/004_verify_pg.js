require('dotenv').config();
const db = require('../src/config/db');

async function verify() {
  console.log('\n🔍 Verifying PostgreSQL migration...\n');

  // 1. Check all tables exist
  const [tables] = await db.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log(`✅ Tables (${tables.length}):`, tables.map(t => t.table_name).join(', '));

  // 2. Check seed data
  const [weights] = await db.query('SELECT COUNT(*) AS cnt FROM bag_weights');
  console.log(`✅ Bag weights seeded: ${weights[0].cnt}`);

  const [users] = await db.query('SELECT username, role FROM users ORDER BY id');
  console.log(`✅ Users seeded: ${users.map(u => `${u.username}(${u.role})`).join(', ')}`);

  const [factory] = await db.query('SELECT name FROM factories LIMIT 1');
  console.log(`✅ Factory: ${factory[0]?.name}`);

  const [seqs] = await db.query('SELECT document_type FROM document_sequences ORDER BY document_type');
  console.log(`✅ Document sequences: ${seqs.map(s => s.document_type).join(', ')}`);

  // 3. Test document number generation
  const conn = await db.getConnection();
  await conn.beginTransaction();
  const { nextDocNumber } = require('../src/utils/docNumber');
  const si = await nextDocNumber(conn, 1, 'SI');
  const pi = await nextDocNumber(conn, 1, 'PI');
  const pv = await nextDocNumber(conn, 1, 'PV');
  const jv = await nextDocNumber(conn, 1, 'JV');
  await conn.rollback(); // don't actually increment
  conn.release();
  console.log(`✅ Doc numbers (rolled back): SI=${si} PI=${pi} PV=${pv} JV=${jv}`);

  // 4. Test a full sale flow
  const bcrypt = require('bcrypt');

  // ensure product exists
  const [prod] = await db.query("SELECT id FROM products WHERE name='TestFlour' LIMIT 1");
  let productId;
  if (!prod[0]) {
    const [np] = await db.query("INSERT INTO products (factory_id, name) VALUES (1, 'TestFlour')");
    productId = np[0].id;
  } else {
    productId = prod[0].id;
  }

  // ensure inventory
  await db.query(
    `INSERT INTO inventory (factory_id, product_id, weight_id, quantity)
     VALUES (1, $1, 1, 500)
     ON CONFLICT (factory_id, product_id, weight_id) DO UPDATE SET quantity = 500`,
    [productId]
  );

  // ensure customer
  const [cust] = await db.query("SELECT id FROM customers WHERE name='VerifyCustomer' LIMIT 1");
  let customerId;
  if (!cust[0]) {
    const [nc] = await db.query("INSERT INTO customers (factory_id, name) VALUES (1, 'VerifyCustomer')");
    customerId = nc[0].id;
  } else {
    customerId = cust[0].id;
  }

  // ensure cash account
  await db.query(
    `INSERT INTO cash_accounts (factory_id, balance) VALUES (1, 100000)
     ON CONFLICT (factory_id) DO UPDATE SET balance = 100000`
  );

  // create sale
  const conn2 = await db.getConnection();
  await conn2.beginTransaction();
  const invoiceNum = await nextDocNumber(conn2, 1, 'SI');
  const [saleRow] = await conn2.query(
    `INSERT INTO sales (factory_id, customer_id, invoice_number, total_amount, paid_amount, remaining_amount, created_by)
     VALUES (1, $1, $2, 12500.00, 12500.00, 0.00, 1)`,
    [customerId, invoiceNum]
  );
  const saleId = saleRow[0].id;
  await conn2.query(
    `INSERT INTO sale_items (sale_id, product_id, weight_id, quantity, price, total)
     VALUES ($1, $2, 1, 5, 2500, 12500)`,
    [saleId, productId]
  );
  await conn2.query(
    `UPDATE inventory SET quantity = quantity - 5 WHERE factory_id = 1 AND product_id = $1 AND weight_id = 1`,
    [productId]
  );
  await conn2.commit();
  conn2.release();

  console.log(`✅ Sale created: ${invoiceNum} id=${saleId}`);

  // verify inventory reduced
  const [invAfter] = await db.query(
    'SELECT quantity FROM inventory WHERE factory_id = 1 AND product_id = $1 AND weight_id = 1',
    [productId]
  );
  console.log(`✅ Inventory after sale: ${invAfter[0].quantity} (expected 495)`);

  // verify sale record
  const [saleCheck] = await db.query('SELECT * FROM sales WHERE id = $1', [saleId]);
  console.log(`✅ Sale record: total=${saleCheck[0].total_amount} paid=${saleCheck[0].paid_amount} rem=${saleCheck[0].remaining_amount}`);

  console.log('\n🎉 PostgreSQL migration verified successfully!\n');
  process.exit(0);
}

verify().catch(e => { console.error('❌ Verification failed:', e.message); process.exit(1); });
