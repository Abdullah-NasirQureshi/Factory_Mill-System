const db = require('../config/db');
const { ok, fail } = require('../utils/response');
const { nextDocNumber } = require('../utils/docNumber');
const { getActiveSeasonId } = require('../utils/activeSeason');

// POST /api/purchases
const createPurchase = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { supplier_id, purchase_date, items, payment_method, payment_amount, bank_id, notes } = req.body;

  if (!supplier_id) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'supplier_id is required');
  if (!purchase_date) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'purchase_date is required');
  if (!items || !items.length) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Purchase must have at least one item');
  if (payment_method && !['CASH', 'BANK', 'NONE'].includes(payment_method))
    return fail(res, 'VALIDATION_INVALID_FORMAT', 'payment_method must be CASH, BANK or NONE');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [sup] = await conn.query(
      'SELECT id FROM suppliers WHERE id = ? AND factory_id = ? AND is_deleted = FALSE',
      [supplier_id, factory_id]
    );
    if (!sup[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Supplier not found', 404); }

    let total_amount = 0;
    const validatedItems = [];
    for (const item of items) {
      const { product_name, quantity, unit_price } = item;
      if (!product_name || !quantity || !unit_price)
        { await conn.rollback(); return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Each item needs product_name, quantity, unit_price'); }
      const lineTotal = Math.round(parseFloat(quantity) * parseFloat(unit_price) * 100) / 100;
      total_amount += lineTotal;
      validatedItems.push({ product_name, quantity: parseFloat(quantity), unit_price: parseFloat(unit_price), total: lineTotal });
    }
    total_amount = Math.round(total_amount * 100) / 100;

    const method = payment_method || 'NONE';
    const paid = method === 'NONE' ? 0 : Math.min(parseFloat(payment_amount) || 0, total_amount);
    const remaining = Math.round((total_amount - paid) * 100) / 100;

    const invoice_number = await nextDocNumber(conn, factory_id, 'PI');
    const season_id = await getActiveSeasonId(conn, factory_id);

    const [pRows] = await conn.query(
      `INSERT INTO purchases (factory_id, supplier_id, invoice_number, total_amount, paid_amount, remaining_amount, purchase_date, created_by, season_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [factory_id, supplier_id, invoice_number, total_amount, paid, remaining, purchase_date, user_id, season_id]
    );
    const purchase_id = pRows[0].id;

    for (const item of validatedItems) {
      await conn.query(
        'INSERT INTO purchase_items (purchase_id, product_name, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)',
        [purchase_id, item.product_name, item.quantity, item.unit_price, item.total]
      );
    }

    if (paid > 0) {
      const voucher_number = await nextDocNumber(conn, factory_id, 'PV');
      const [payRows] = await conn.query(
        `INSERT INTO payments (factory_id, voucher_number, type, reference_id, payment_method, bank_id, amount, created_by, season_id)
         VALUES (?, ?, 'SUPPLIER_PAYMENT', ?, ?, ?, ?, ?, ?)`,
        [factory_id, voucher_number, supplier_id, method, bank_id || null, paid, user_id, season_id]
      );
      await conn.query(
        `INSERT INTO payment_allocations (payment_id, reference_type, reference_id, allocated_amount)
         VALUES (?, 'PURCHASE', ?, ?)`,
        [payRows[0].id, purchase_id, paid]
      );
      if (method === 'CASH') {
        await conn.query('UPDATE cash_accounts SET balance = balance - ? WHERE factory_id = ?', [paid, factory_id]);
      } else {
        await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ?', [paid, bank_id]);
      }
      await conn.query(
        `INSERT INTO transactions (factory_id, transaction_type, source_type, source_id, payment_method, bank_id, amount, reference_id, season_id)
         VALUES (?, 'OUT', 'SUPPLIER', ?, ?, ?, ?, ?, ?)`,
        [factory_id, supplier_id, method, bank_id || null, paid, payRows[0].id, season_id]
      );
    }

    await conn.commit();
    const [purchaseRows] = await db.query('SELECT * FROM purchases WHERE id = ?', [purchase_id]);
    return ok(res, { purchase: purchaseRows[0] }, 201);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

// GET /api/purchases
const getPurchases = async (req, res) => {
  const { factory_id } = req.user;
  const { supplier_id, from, to, status } = req.query;

  const [seasonRows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
  );
  const season_id = seasonRows[0]?.id || null;

  let sql = `SELECT p.*, s.name AS supplier_name FROM purchases p
             JOIN suppliers s ON s.id = p.supplier_id WHERE p.factory_id = ?`;
  const params = [factory_id];
  if (season_id)   { sql += ' AND p.season_id = ?';    params.push(season_id); }
  if (supplier_id) { sql += ' AND p.supplier_id = ?';  params.push(supplier_id); }
  if (status)      { sql += ' AND p.status = ?';       params.push(status); }
  if (from)        { sql += ' AND p.created_at >= ?';  params.push(from); }
  if (to)          { sql += ' AND p.created_at <= ?';  params.push(to); }
  sql += ' ORDER BY p.created_at DESC';
  const [rows] = await db.query(sql, params);
  return ok(res, { purchases: rows });
};

// GET /api/purchases/:id
const getPurchase = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const [purchases] = await db.query(
    `SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, s.address AS supplier_address
     FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.id = ? AND p.factory_id = ?`,
    [id, factory_id]
  );
  if (!purchases[0]) return fail(res, 'NOT_FOUND', 'Purchase not found', 404);
  const [items] = await db.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [id]);
  const [payments] = await db.query(
    `SELECT pay.*, pa.allocated_amount FROM payments pay
     JOIN payment_allocations pa ON pa.payment_id = pay.id
     WHERE pa.reference_type = 'PURCHASE' AND pa.reference_id = ? AND pay.status = 'ACTIVE'`, [id]
  );
  return ok(res, { purchase: purchases[0], items, payments });
};

// GET /api/purchases/:id/invoice
const getPurchaseInvoice = async (req, res) => {
  const { factory_id } = req.user;
  const { id } = req.params;
  const [purchases] = await db.query(
    `SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, s.address AS supplier_address
     FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.id = ? AND p.factory_id = ?`,
    [id, factory_id]
  );
  if (!purchases[0]) return fail(res, 'NOT_FOUND', 'Purchase not found', 404);
  const [items] = await db.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [id]);
  const [payments] = await db.query(
    `SELECT pay.voucher_number, pay.payment_method, pay.amount, pay.created_at,
            ba.bank_name, pa.allocated_amount
     FROM payments pay JOIN payment_allocations pa ON pa.payment_id = pay.id
     LEFT JOIN bank_accounts ba ON ba.id = pay.bank_id
     WHERE pa.reference_type = 'PURCHASE' AND pa.reference_id = ? AND pay.status = 'ACTIVE'`, [id]
  );
  const [settings] = await db.query('SELECT * FROM settings WHERE factory_id = ?', [factory_id]);
  return ok(res, { invoice: { purchase: purchases[0], items, payments, settings: settings[0] || {} } });
};

module.exports = { createPurchase, getPurchases, getPurchase, getPurchaseInvoice };
