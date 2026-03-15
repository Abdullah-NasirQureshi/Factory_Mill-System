/**
 * Full API test — runs against live server on port 5000
 * Tests every endpoint end-to-end with real data
 */
require('dotenv').config();
const http = require('http');

const BASE = 'http://localhost:5000';
let TOKEN = '';
let results = { pass: 0, fail: 0, errors: [] };

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: 'localhost',
      port: 5000,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function pass(label) {
  results.pass++;
  console.log(`  ✅ ${label}`);
}
function fail(label, detail) {
  results.fail++;
  results.errors.push({ label, detail });
  console.log(`  ❌ ${label} — ${JSON.stringify(detail)}`);
}
function check(label, res, expectStatus, expectKey) {
  if (res.status !== expectStatus) {
    fail(label, { status: res.status, body: res.body });
    return false;
  }
  // ok() spreads data directly: { success: true, [key]: value }
  if (expectKey && res.body?.[expectKey] === undefined) {
    fail(label, { missing_key: expectKey, keys: Object.keys(res.body || {}) });
    return false;
  }
  pass(label);
  return true;
}

async function run() {
  console.log('\n🔍 FACTORY ERP — FULL API TEST\n');

  // ── AUTH ──────────────────────────────────────────────────
  console.log('── AUTH ──');
  let r = await req('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  if (r.status === 200 && r.body.token) {
    TOKEN = r.body.token;
    pass('POST /api/auth/login (admin)');
  } else { fail('POST /api/auth/login', r.body); return; }

  r = await req('GET', '/api/auth/me', null, TOKEN);
  check('GET /api/auth/me', r, 200, 'user');

  r = await req('POST', '/api/auth/login', { username: 'accountant', password: 'acc123' });
  check('POST /api/auth/login (accountant)', r, 200);

  r = await req('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
  if (r.status === 401) pass('POST /api/auth/login (wrong password → 401)');
  else fail('Wrong password should 401', r.body);

  // ── SETTINGS ──────────────────────────────────────────────
  console.log('\n── SETTINGS ──');
  r = await req('GET', '/api/settings', null, TOKEN);
  check('GET /api/settings', r, 200, 'settings');

  r = await req('PUT', '/api/settings', { company_name: 'Test Mill', phone: '0300-1234567' }, TOKEN);
  check('PUT /api/settings', r, 200, 'settings');

  // ── PRODUCTS ──────────────────────────────────────────────
  console.log('\n── PRODUCTS ──');
  r = await req('GET', '/api/products', null, TOKEN);
  check('GET /api/products', r, 200, 'products');

  r = await req('POST', '/api/products', { name: 'Wheat Flour' }, TOKEN);
  let productId;
  if (check('POST /api/products', r, 201, 'product')) productId = r.body.product.id;

  r = await req('GET', '/api/products/active', null, TOKEN);
  check('GET /api/products/active', r, 200, 'products');

  if (productId) {
    r = await req('PUT', `/api/products/${productId}`, { name: 'Wheat Flour Updated' }, TOKEN);
    check('PUT /api/products/:id', r, 200, 'product');

    r = await req('PUT', `/api/products/${productId}/status`, { status: 'INACTIVE' }, TOKEN);
    check('PUT /api/products/:id/status (INACTIVE)', r, 200);

    r = await req('PUT', `/api/products/${productId}/status`, { status: 'ACTIVE' }, TOKEN);
    check('PUT /api/products/:id/status (ACTIVE)', r, 200);
  }

  // ── WEIGHTS ───────────────────────────────────────────────
  console.log('\n── WEIGHTS ──');
  r = await req('GET', '/api/weights', null, TOKEN);
  check('GET /api/weights', r, 200, 'weights');

  // ── INVENTORY ─────────────────────────────────────────────
  console.log('\n── INVENTORY ──');
  r = await req('GET', '/api/inventory', null, TOKEN);
  check('GET /api/inventory', r, 200, 'inventory');

  r = await req('GET', '/api/inventory/low-stock', null, TOKEN);
  check('GET /api/inventory/low-stock', r, 200, 'low_stock');

  // Add stock for our test product
  if (productId) {
    r = await req('POST', '/api/inventory/add', { product_id: productId, weight_id: 1, quantity: 100, note: 'Opening stock' }, TOKEN);
    check('POST /api/inventory/add', r, 201, 'inventory');

    r = await req('POST', '/api/inventory/adjust', { product_id: productId, weight_id: 1, quantity: 10, note: 'Test adjustment' }, TOKEN);
    check('POST /api/inventory/adjust', r, 200, 'inventory');
  }

  r = await req('GET', '/api/inventory/stock-transactions', null, TOKEN);
  check('GET /api/inventory/stock-transactions', r, 200, 'transactions');

  // ── CUSTOMERS ─────────────────────────────────────────────
  console.log('\n── CUSTOMERS ──');
  r = await req('POST', '/api/customers', { name: 'API Test Customer', phone: '0311-1111111' }, TOKEN);
  let customerId;
  if (check('POST /api/customers', r, 201, 'customer')) customerId = r.body.customer.id;

  r = await req('GET', '/api/customers', null, TOKEN);
  check('GET /api/customers', r, 200, 'customers');

  r = await req('GET', '/api/customers?search=API', null, TOKEN);
  check('GET /api/customers?search=', r, 200, 'customers');

  if (customerId) {
    r = await req('GET', `/api/customers/${customerId}`, null, TOKEN);
    check('GET /api/customers/:id', r, 200, 'customer');

    r = await req('PUT', `/api/customers/${customerId}`, { name: 'API Test Customer Updated', phone: '0311-2222222' }, TOKEN);
    check('PUT /api/customers/:id', r, 200, 'customer');
  }

  // ── SUPPLIERS ─────────────────────────────────────────────
  console.log('\n── SUPPLIERS ──');
  r = await req('POST', '/api/suppliers', { name: 'API Test Supplier', phone: '0322-9999999' }, TOKEN);
  let supplierId;
  if (check('POST /api/suppliers', r, 201, 'supplier')) supplierId = r.body.supplier.id;

  r = await req('GET', '/api/suppliers', null, TOKEN);
  check('GET /api/suppliers', r, 200, 'suppliers');

  if (supplierId) {
    r = await req('GET', `/api/suppliers/${supplierId}`, null, TOKEN);
    check('GET /api/suppliers/:id', r, 200, 'supplier');

    r = await req('PUT', `/api/suppliers/${supplierId}`, { name: 'API Test Supplier Updated' }, TOKEN);
    check('PUT /api/suppliers/:id', r, 200, 'supplier');
  }

  // ── CASH ──────────────────────────────────────────────────
  console.log('\n── CASH ──');
  r = await req('GET', '/api/cash', null, TOKEN);
  check('GET /api/cash', r, 200, 'cash');

  r = await req('PUT', '/api/cash/balance', { balance: 50000, notes: 'Test set' }, TOKEN);
  check('PUT /api/cash/balance (admin)', r, 200, 'cash');

  // ── BANKS ─────────────────────────────────────────────────
  console.log('\n── BANKS ──');
  r = await req('POST', '/api/banks', { bank_name: 'HBL', account_title: 'Test Mill', account_number: '1234567890', balance: 100000 }, TOKEN);
  let bankId;
  if (check('POST /api/banks', r, 201, 'bank')) bankId = r.body.bank.id;

  r = await req('GET', '/api/banks', null, TOKEN);
  check('GET /api/banks', r, 200, 'banks');

  if (bankId) {
    r = await req('PUT', `/api/banks/${bankId}`, { bank_name: 'HBL Updated', account_title: 'Test Mill', account_number: '1234567890' }, TOKEN);
    check('PUT /api/banks/:id', r, 200, 'bank');

    r = await req('PUT', `/api/banks/${bankId}/balance`, { balance: 200000, notes: 'Test balance set' }, TOKEN);
    check('PUT /api/banks/:id/balance', r, 200, 'bank');
  }

  // ── USERS ─────────────────────────────────────────────────
  console.log('\n── USERS ──');
  r = await req('GET', '/api/users', null, TOKEN);
  check('GET /api/users', r, 200, 'users');

  r = await req('POST', '/api/users', { username: `testuser_${Date.now()}`, password: 'test123', role: 'ACCOUNTANT' }, TOKEN);
  let testUserId;
  if (check('POST /api/users', r, 201, 'user')) testUserId = r.body.user.id;

  if (testUserId) {
    r = await req('PUT', `/api/users/${testUserId}`, { username: 'testuser_updated' }, TOKEN);
    check('PUT /api/users/:id', r, 200);

    r = await req('DELETE', `/api/users/${testUserId}`, null, TOKEN);
    check('DELETE /api/users/:id', r, 200);
  }

  // ── SALES ─────────────────────────────────────────────────
  console.log('\n── SALES ──');
  let saleId;
  if (customerId && productId) {
    r = await req('POST', '/api/sales', {
      customer_id: customerId,
      items: [{ product_id: productId, weight_id: 1, quantity: 5, price: 2500 }],
      payment_method: 'CASH',
      payment_amount: 10000,
    }, TOKEN);
    if (check('POST /api/sales (CASH partial)', r, 201, 'sale')) saleId = r.body.sale.id;

    // Sale with NONE payment
    r = await req('POST', '/api/sales', {
      customer_id: customerId,
      items: [{ product_id: productId, weight_id: 1, quantity: 2, price: 2500 }],
      payment_method: 'NONE',
    }, TOKEN);
    check('POST /api/sales (NONE payment)', r, 201, 'sale');
  }

  r = await req('GET', '/api/sales', null, TOKEN);
  check('GET /api/sales', r, 200, 'sales');

  if (saleId) {
    r = await req('GET', `/api/sales/${saleId}`, null, TOKEN);
    check('GET /api/sales/:id', r, 200, 'sale');

    r = await req('GET', `/api/sales/${saleId}/invoice`, null, TOKEN);
    check('GET /api/sales/:id/invoice', r, 200, 'invoice');
  }

  // ── PURCHASES ─────────────────────────────────────────────
  console.log('\n── PURCHASES ──');
  let purchaseId;
  if (supplierId) {
    r = await req('POST', '/api/purchases', {
      supplier_id: supplierId,
      purchase_date: new Date().toISOString().slice(0, 10),
      items: [{ product_name: 'Wheat', quantity: 100, unit_price: 150 }],
      payment_method: 'CASH',
      payment_amount: 10000,
    }, TOKEN);
    if (check('POST /api/purchases (CASH partial)', r, 201, 'purchase')) purchaseId = r.body.purchase.id;

    r = await req('POST', '/api/purchases', {
      supplier_id: supplierId,
      purchase_date: new Date().toISOString().slice(0, 10),
      items: [{ product_name: 'Bran', quantity: 50, unit_price: 80 }],
      payment_method: 'NONE',
    }, TOKEN);
    check('POST /api/purchases (NONE payment)', r, 201, 'purchase');
  }

  r = await req('GET', '/api/purchases', null, TOKEN);
  check('GET /api/purchases', r, 200, 'purchases');

  if (purchaseId) {
    r = await req('GET', `/api/purchases/${purchaseId}`, null, TOKEN);
    check('GET /api/purchases/:id', r, 200, 'purchase');

    r = await req('GET', `/api/purchases/${purchaseId}/invoice`, null, TOKEN);
    check('GET /api/purchases/:id/invoice', r, 200, 'invoice');
  }

  // ── PAYMENTS ──────────────────────────────────────────────
  console.log('\n── PAYMENTS ──');
  let paymentId;
  if (customerId) {
    r = await req('POST', '/api/payments/customer', {
      customer_id: customerId,
      amount: 2000,
      payment_method: 'CASH',
    }, TOKEN);
    if (check('POST /api/payments/customer', r, 201, 'payment')) paymentId = r.body.payment.id;
  }

  if (supplierId) {
    r = await req('POST', '/api/payments/supplier', {
      supplier_id: supplierId,
      amount: 3000,
      payment_method: 'CASH',
    }, TOKEN);
    check('POST /api/payments/supplier', r, 201, 'payment');
  }

  r = await req('GET', '/api/payments', null, TOKEN);
  check('GET /api/payments', r, 200, 'payments');

  if (paymentId) {
    r = await req('GET', `/api/payments/${paymentId}/voucher`, null, TOKEN);
    check('GET /api/payments/:id/voucher', r, 200, 'voucher');
  }

  // ── TRANSACTIONS ──────────────────────────────────────────
  console.log('\n── TRANSACTIONS ──');
  r = await req('GET', '/api/transactions', null, TOKEN);
  check('GET /api/transactions', r, 200, 'transactions');

  r = await req('GET', '/api/transactions?type=IN', null, TOKEN);
  check('GET /api/transactions?type=IN', r, 200, 'transactions');

  if (r.body?.transactions?.length > 0) {
    const txId = r.body.transactions[0].id;
    r = await req('GET', `/api/transactions/${txId}`, null, TOKEN);
    check('GET /api/transactions/:id', r, 200, 'transaction');
  }

  // ── REPORTS ───────────────────────────────────────────────
  console.log('\n── REPORTS ──');
  r = await req('GET', '/api/reports/dashboard', null, TOKEN);
  check('GET /api/reports/dashboard', r, 200, 'today');

  r = await req('GET', '/api/reports/sales/daily', null, TOKEN);
  check('GET /api/reports/sales/daily', r, 200, 'sales');

  r = await req('GET', '/api/reports/sales/monthly', null, TOKEN);
  check('GET /api/reports/sales/monthly', r, 200, 'summary');

  r = await req('GET', '/api/reports/sales/by-product', null, TOKEN);
  check('GET /api/reports/sales/by-product', r, 200, 'products');

  r = await req('GET', '/api/reports/inventory', null, TOKEN);
  check('GET /api/reports/inventory', r, 200, 'inventory');

  r = await req('GET', '/api/reports/customer-dues', null, TOKEN);
  check('GET /api/reports/customer-dues', r, 200, 'customers');

  r = await req('GET', '/api/reports/supplier-payables', null, TOKEN);
  check('GET /api/reports/supplier-payables', r, 200, 'suppliers');

  r = await req('GET', '/api/reports/cash-flow', null, TOKEN);
  check('GET /api/reports/cash-flow', r, 200, 'flow');

  r = await req('GET', '/api/reports/transactions', null, TOKEN);
  check('GET /api/reports/transactions', r, 200, 'transactions');

  // ── REVERSAL ──────────────────────────────────────────────
  console.log('\n── REVERSALS ──');
  if (paymentId) {
    r = await req('POST', `/api/payments/${paymentId}/revert`, null, TOKEN);
    check('POST /api/payments/:id/revert', r, 200);
  }
  if (saleId) {
    r = await req('POST', `/api/sales/${saleId}/revert`, null, TOKEN);
    check('POST /api/sales/:id/revert', r, 200);
  }

  // ── SUMMARY ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(`  RESULTS: ${results.pass} passed, ${results.fail} failed`);
  if (results.errors.length) {
    console.log('\n  FAILURES:');
    results.errors.forEach(e => console.log(`    ❌ ${e.label}:`, JSON.stringify(e.detail)));
  }
  console.log('═'.repeat(50));
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
