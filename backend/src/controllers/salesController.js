const db = require('../config/db');
const { ok, fail } = require('../utils/response');
const { nextDocNumber } = require('../utils/docNumber');

// POST /api/sales
const createSale = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { customer_id, items, payment_method, payment_amount, bank_id, notes } = req.body;

  if (!customer_id) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'customer_id is required');
  if (!items || !items.length) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Sale must have at least one item');
  if (!['CASH', 'BANK', 'NONE'].includes(payment_method))
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'payment_method must be CASH, BANK or NONE');
  if (payment_method === 'BANK' && !bank_id)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'bank_id is required for BANK payment');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // validate customer
    const [cust] = await conn.query(
      'SELECT id FROM customers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
      [customer_id, factory_id]
    );
    if (!cust[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Customer not found', 404); }

    // validate & lock inventory for each item
    let total_amount = 0;
    const validatedItems = [];
    for (const item of items) {
      const { product_id, weight_id, quantity, price } = item;
      if (!product_id || !weight_id || !quantity || !price)
        { await conn.rollback(); return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Each item needs product_id, weight_id, quantity, price'); }

      const [inv] = await conn.query(
        'SELECT quantity FROM inventory WHERE factory_id = ? AND product_id = ? AND weight_id = ? FOR UPDATE',
        [factory_id, product_id, weight_id]
      );
      if (!inv[0] || parseFloat(inv[0].quantity) < parseFloat(quantity))
        { await conn.rollback(); return fail(res, 'BUSINESS_INSUFFICIENT_INVENTORY', `Insufficient inventory for product ${product_id} weight ${weight_id}`); }

      const lineTotal = Math.round(parseFloat(quantity) * parseFloat(price) * 100) / 100;
      total_amount += lineTotal;
      validatedItems.push({ product_id, weight_id, quantity: parseFloat(quantity), price: parseFloat(price), total: lineTotal });
    }
    total_amount = Math.round(total_amount * 100) / 100;

    const paid = payment_method === 'NONE' ? 0 : Math.min(parseFloat(payment_amount) || 0, total_amount);
    const remaining = Math.round((total_amount - paid) * 100) / 100;

    // generate invoice number
    const invoice_number = await nextDocNumber(conn, factory_id, 'SI');

    // insert sale
    const [saleResult] = await conn.query(
      `INSERT INTO sales (factory_id, customer_id, invoice_number, total_amount, paid_amount, remaining_amount, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [factory_id, customer_id, invoice_number, total_amount, paid, remaining, user_id]
    );
    const sale_id = saleResult.insertId;

    // insert sale items + reduce inventory + stock transactions
    for (const item of validatedItems) {
      await conn.query(
        'INSERT INTO sale_items (sale_id, product_id, weight_id, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)',
        [sale_id, item.product_id, item.weight_id, item.quantity, item.price, item.total]
      );
      await conn.query(
        'UPDATE inventory SET quantity = quantity - ? WHERE factory_id = ? AND product_id = ? AND weight_id = ?',
        [item.quantity, factory_id, item.product_id, item.weight_id]
      );
      await conn.query(
        `INSERT INTO stock_transactions (factory_id, product_id, weight_id, type, quantity, reference_id)
         VALUES (?, ?, ?, 'SALE', ?, ?)`,
        [factory_id, item.product_id, item.weight_id, item.quantity, sale_id]
      );
    }

    // handle payment
    if (paid > 0) {
      const voucher_number = await nextDocNumber(conn, factory_id, 'PV');
      const [payResult] = await conn.query(
        `INSERT INTO payments (factory_id, voucher_number, type, reference_id, payment_method, bank_id, amount, created_by)
         VALUES (?, ?, 'CUSTOMER_PAYMENT', ?, ?, ?, ?, ?)`,
        [factory_id, voucher_number, customer_id, payment_method, bank_id || null, paid, user_id]
      );
      await conn.query(
        `INSERT INTO payment_allocations (payment_id, reference_type, reference_id, allocated_amount)
         VALUES (?, 'SALE', ?, ?)`,
        [payResult.insertId, sale_id, paid]
      );

      // update cash/bank
      if (payment_method === 'CASH') {
        await conn.query('UPDATE cash_accounts SET balance = balance + ? WHERE factory_id = ?', [paid, factory_id]);
      } else {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ?', [paid, bank_id]);
      }

      // ledger entry
      await conn.query(
        `INSERT INTO transactions (factory_id, transaction_type, source_type, source_id, payment_method, bank_id, amount, reference_id)
         VALUES (?, 'IN', 'CUSTOMER', ?, ?, ?, ?, ?)`,
        [factory_id, customer_id, payment_method, bank_id || null, paid, payResult.insertId]
      );
    }

    await conn.commit();

    const [sale] = await conn.query('SELECT * FROM sales WHERE id = ?', [sale_id]);
    return ok(res, { sale: sale[0] }, 201);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// GET /api/sales
const getSales = async (req, res) => {
  const { factory_id } = req.user;
  const { customer_id, from, to, status } = req.query;
  let sql = `SELECT s.*, c.name AS customer_name FROM sales s
             JOIN customers c ON c.id = s.customer_id
             WHERE s.factory_id = ?`;
  const params = [factory_id];
  if (customer_id) { sql += ' AND s.customer_id = ?'; params.push(customer_id); }
  if (status)      { sql += ' AND s.status = ?';      params.push(status); }
  if (from)        { sql += ' AND s.created_at >= ?'; params.push(from); }
  if (to)          { sql += ' AND s.created_at <= ?'; params.push(to); }
  sql += ' ORDER BY s.created_at DESC';
  const [rows] = await db.query(sql, params);
  return ok(res, { sales: rows });
};

// GET /api/sales/:id
const getSale = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const [sales] = await db.query(
    `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM sales s JOIN customers c ON c.id = s.customer_id
     WHERE s.id = ? AND s.factory_id = ?`,
    [id, factory_id]
  );
  if (!sales[0]) return fail(res, 'NOT_FOUND', 'Sale not found', 404);

  const [items] = await db.query(
    `SELECT si.*, p.name AS product_name, bw.weight_value, bw.unit
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN bag_weights bw ON bw.id = si.weight_id
     WHERE si.sale_id = ?`,
    [id]
  );
  const [payments] = await db.query(
    `SELECT pay.*, pa.allocated_amount FROM payments pay
     JOIN payment_allocations pa ON pa.payment_id = pay.id
     WHERE pa.reference_type = 'SALE' AND pa.reference_id = ? AND pay.status = 'ACTIVE'`,
    [id]
  );
  return ok(res, { sale: sales[0], items, payments });
};

// GET /api/sales/:id/invoice
const getInvoice = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const [sales] = await db.query(
    `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM sales s JOIN customers c ON c.id = s.customer_id
     WHERE s.id = ? AND s.factory_id = ?`,
    [id, factory_id]
  );
  if (!sales[0]) return fail(res, 'NOT_FOUND', 'Sale not found', 404);

  const [items] = await db.query(
    `SELECT si.*, p.name AS product_name, bw.weight_value, bw.unit
     FROM sale_items si JOIN products p ON p.id = si.product_id
     JOIN bag_weights bw ON bw.id = si.weight_id WHERE si.sale_id = ?`, [id]
  );
  const [payments] = await db.query(
    `SELECT pay.voucher_number, pay.payment_method, pay.amount, pay.created_at,
            ba.bank_name, pa.allocated_amount
     FROM payments pay
     JOIN payment_allocations pa ON pa.payment_id = pay.id
     LEFT JOIN bank_accounts ba ON ba.id = pay.bank_id
     WHERE pa.reference_type = 'SALE' AND pa.reference_id = ? AND pay.status = 'ACTIVE'`, [id]
  );
  const [settings] = await db.query('SELECT * FROM settings WHERE factory_id = ?', [factory_id]);

  return ok(res, { invoice: { sale: sales[0], items, payments, settings: settings[0] || {} } });
};

// POST /api/sales/:id/revert
const revertSale = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { id } = req.params;

  const [sales] = await db.query(
    "SELECT * FROM sales WHERE id = ? AND factory_id = ? AND status = 'ACTIVE'", [id, factory_id]
  );
  if (!sales[0]) return fail(res, 'NOT_FOUND', 'Active sale not found', 404);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // restore inventory
    const [items] = await conn.query('SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    for (const item of items) {
      await conn.query(
        'UPDATE inventory SET quantity = quantity + ? WHERE factory_id = ? AND product_id = ? AND weight_id = ?',
        [item.quantity, factory_id, item.product_id, item.weight_id]
      );
      await conn.query(
        `INSERT INTO stock_transactions (factory_id, product_id, weight_id, type, quantity, reference_id, note)
         VALUES (?, ?, ?, 'ADJUST', ?, ?, 'Sale reversal')`,
        [factory_id, item.product_id, item.weight_id, item.quantity, id]
      );
    }

    // reverse payments
    const [allocs] = await conn.query(
      "SELECT pa.*, pay.payment_method, pay.bank_id, pay.amount FROM payment_allocations pa JOIN payments pay ON pay.id = pa.payment_id WHERE pa.reference_type = 'SALE' AND pa.reference_id = ? AND pay.status = 'ACTIVE'",
      [id]
    );
    for (const alloc of allocs) {
      if (alloc.payment_method === 'CASH') {
        await conn.query('UPDATE cash_accounts SET balance = balance - ? WHERE factory_id = ?', [alloc.allocated_amount, factory_id]);
      } else {
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [alloc.allocated_amount, alloc.bank_id]);
      }
      await conn.query("UPDATE payments SET status = 'REVERTED' WHERE id = ?", [alloc.payment_id]);
      await conn.query(
        `INSERT INTO transactions (factory_id, transaction_type, source_type, source_id, payment_method, bank_id, amount, reference_id, notes)
         VALUES (?, 'REVERSAL', 'CUSTOMER', ?, ?, ?, ?, ?, 'Sale reversal')`,
        [factory_id, sales[0].customer_id, alloc.payment_method, alloc.bank_id || null, alloc.allocated_amount, alloc.payment_id]
      );
    }

    await conn.query("UPDATE sales SET status = 'REVERTED' WHERE id = ?", [id]);
    await conn.commit();
    return ok(res, { message: 'Sale reverted successfully' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = { createSale, getSales, getSale, getInvoice, revertSale };
