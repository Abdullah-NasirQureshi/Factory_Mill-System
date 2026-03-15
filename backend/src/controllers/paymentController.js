const db = require('../config/db');
const { ok, fail } = require('../utils/response');
const { nextDocNumber } = require('../utils/docNumber');
const { allocatePayment } = require('../utils/allocate');

// POST /api/payments/customer
const recordCustomerPayment = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { customer_id, amount, payment_method, bank_id, notes } = req.body;

  if (!customer_id || !amount || !payment_method)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'customer_id, amount and payment_method are required');
  if (!['CASH', 'BANK'].includes(payment_method))
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'payment_method must be CASH or BANK');
  if (payment_method === 'BANK' && !bank_id)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'bank_id is required for BANK payment');
  if (parseFloat(amount) <= 0)
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'Amount must be positive');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [cust] = await conn.query(
      'SELECT id FROM customers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
      [customer_id, factory_id]
    );
    if (!cust[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Customer not found', 404); }

    const voucher_number = await nextDocNumber(conn, factory_id, 'PV');
    const [payRows] = await conn.query(
      `INSERT INTO payments (factory_id, voucher_number, type, reference_id, payment_method, bank_id, amount, notes, created_by)
       VALUES (?, ?, 'CUSTOMER_PAYMENT', ?, ?, ?, ?, ?, ?)`,
      [factory_id, voucher_number, customer_id, payment_method, bank_id || null, amount, notes || null, user_id]
    );
    const payment_id = payRows[0].id;

    // oldest-first allocation
    await allocatePayment(conn, 'SALE', 'sales', customer_id, 'customer_id', factory_id, payment_id, amount);

    // update cash/bank balance
    if (payment_method === 'CASH') {
      await conn.query('UPDATE cash_accounts SET balance = balance + ? WHERE factory_id = ?', [amount, factory_id]);
    } else {
      await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [amount, bank_id]);
    }

    // ledger entry
    await conn.query(
      `INSERT INTO transactions (factory_id, transaction_type, source_type, source_id, payment_method, bank_id, amount, reference_id, notes)
       VALUES (?, 'IN', 'CUSTOMER', ?, ?, ?, ?, ?, ?)`,
      [factory_id, customer_id, payment_method, bank_id || null, amount, payment_id, notes || null]
    );

    await conn.commit();
    const [paymentRows] = await db.query('SELECT * FROM payments WHERE id = ?', [payment_id]);
    return ok(res, { payment: paymentRows[0] }, 201);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// POST /api/payments/supplier
const recordSupplierPayment = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { supplier_id, amount, payment_method, bank_id, notes } = req.body;

  if (!supplier_id || !amount || !payment_method)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'supplier_id, amount and payment_method are required');
  if (!['CASH', 'BANK'].includes(payment_method))
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'payment_method must be CASH or BANK');
  if (payment_method === 'BANK' && !bank_id)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'bank_id is required for BANK payment');
  if (parseFloat(amount) <= 0)
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'Amount must be positive');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [sup] = await conn.query(
      'SELECT id FROM suppliers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
      [supplier_id, factory_id]
    );
    if (!sup[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Supplier not found', 404); }

    const voucher_number = await nextDocNumber(conn, factory_id, 'PV');
    const [payRows2] = await conn.query(
      `INSERT INTO payments (factory_id, voucher_number, type, reference_id, payment_method, bank_id, amount, notes, created_by)
       VALUES (?, ?, 'SUPPLIER_PAYMENT', ?, ?, ?, ?, ?, ?)`,
      [factory_id, voucher_number, supplier_id, payment_method, bank_id || null, amount, notes || null, user_id]
    );
    const payment_id = payRows2[0].id;

    await allocatePayment(conn, 'PURCHASE', 'purchases', supplier_id, 'supplier_id', factory_id, payment_id, amount);

    if (payment_method === 'CASH') {
      await conn.query('UPDATE cash_accounts SET balance = balance - ? WHERE factory_id = ?', [amount, factory_id]);
    } else {
      await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [amount, bank_id]);
    }

    await conn.query(
      `INSERT INTO transactions (factory_id, transaction_type, source_type, source_id, payment_method, bank_id, amount, reference_id, notes)
       VALUES (?, 'OUT', 'SUPPLIER', ?, ?, ?, ?, ?, ?)`,
      [factory_id, supplier_id, payment_method, bank_id || null, amount, payment_id, notes || null]
    );

    await conn.commit();
    const [paymentRows2] = await db.query('SELECT * FROM payments WHERE id = ?', [payment_id]);
    return ok(res, { payment: paymentRows2[0] }, 201);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// GET /api/payments
const getPayments = async (req, res) => {
  const { factory_id } = req.user;
  const { type, from, to } = req.query;
  let sql = `SELECT pay.*, ba.bank_name FROM payments pay
             LEFT JOIN bank_accounts ba ON ba.id = pay.bank_id
             WHERE pay.factory_id = ?`;
  const params = [factory_id];
  if (type) { sql += ' AND pay.type = ?'; params.push(type); }
  if (from) { sql += ' AND pay.created_at >= ?'; params.push(from); }
  if (to)   { sql += ' AND pay.created_at <= ?'; params.push(to); }
  sql += ' ORDER BY pay.created_at DESC';
  const [rows] = await db.query(sql, params);
  return ok(res, { payments: rows });
};

// GET /api/payments/:id/voucher
const getVoucher = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const [payments] = await db.query(
    `SELECT pay.*, ba.bank_name,
            CASE WHEN pay.type = 'CUSTOMER_PAYMENT' THEN c.name ELSE s.name END AS party_name
     FROM payments pay
     LEFT JOIN bank_accounts ba ON ba.id = pay.bank_id
     LEFT JOIN customers c ON pay.type = 'CUSTOMER_PAYMENT' AND c.id = pay.reference_id
     LEFT JOIN suppliers s ON pay.type = 'SUPPLIER_PAYMENT' AND s.id = pay.reference_id
     WHERE pay.id = ? AND pay.factory_id = ?`,
    [id, factory_id]
  );
  if (!payments[0]) return fail(res, 'NOT_FOUND', 'Payment not found', 404);
  const [allocations] = await db.query(
    'SELECT * FROM payment_allocations WHERE payment_id = ?', [id]
  );
  const [settings] = await db.query('SELECT * FROM settings WHERE factory_id = ?', [factory_id]);
  return ok(res, { voucher: { payment: payments[0], allocations, settings: settings[0] || {} } });
};

// POST /api/payments/:id/revert
const revertPayment = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;

  const [payments] = await db.query(
    "SELECT * FROM payments WHERE id = ? AND factory_id = ? AND status = 'ACTIVE'", [id, factory_id]
  );
  if (!payments[0]) return fail(res, 'NOT_FOUND', 'Active payment not found', 404);
  const pay = payments[0];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // reverse allocations
    const [allocs] = await conn.query('SELECT * FROM payment_allocations WHERE payment_id = ?', [id]);
    for (const alloc of allocs) {
      const table = alloc.reference_type === 'SALE' ? 'sales' : 'purchases';
      await conn.query(
        `UPDATE ${table} SET paid_amount = paid_amount - ?, remaining_amount = remaining_amount + ? WHERE id = ?`,
        [alloc.allocated_amount, alloc.allocated_amount, alloc.reference_id]
      );
    }

    // reverse cash/bank
    if (pay.payment_method === 'CASH') {
      const delta = pay.type === 'CUSTOMER_PAYMENT' ? -pay.amount : pay.amount;
      await conn.query('UPDATE cash_accounts SET balance = balance + ? WHERE factory_id = ?', [delta, factory_id]);
    } else {
      const delta = pay.type === 'CUSTOMER_PAYMENT' ? -pay.amount : pay.amount;
      await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [delta, pay.bank_id]);
    }

    await conn.query("UPDATE payments SET status = 'REVERTED' WHERE id = ?", [id]);

    const sourceType = pay.type === 'CUSTOMER_PAYMENT' ? 'CUSTOMER' : 'SUPPLIER';
    await conn.query(
      `INSERT INTO transactions (factory_id, transaction_type, source_type, source_id, payment_method, bank_id, amount, reference_id, notes)
       VALUES (?, 'REVERSAL', ?, ?, ?, ?, ?, ?, 'Payment reversal')`,
      [factory_id, sourceType, pay.reference_id, pay.payment_method, pay.bank_id || null, pay.amount, id]
    );

    await conn.commit();
    return ok(res, { message: 'Payment reverted successfully' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { recordCustomerPayment, recordSupplierPayment, getPayments, getVoucher, revertPayment };
