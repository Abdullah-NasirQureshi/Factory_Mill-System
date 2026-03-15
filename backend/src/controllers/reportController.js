const db = require('../config/db');
const { ok } = require('../utils/response');

// GET /api/reports/sales/daily?date=YYYY-MM-DD
const getDailySalesReport = async (req, res) => {
  const { factory_id } = req.user;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const [summary] = await db.query(
    `SELECT COUNT(*) AS total_bills,
            COALESCE(SUM(total_amount), 0) AS total_sales,
            COALESCE(SUM(paid_amount), 0) AS total_collected,
            COALESCE(SUM(remaining_amount), 0) AS total_outstanding
     FROM sales
     WHERE factory_id = ? AND status = 'ACTIVE' AND DATE(created_at) = ?`,
    [factory_id, date]
  );

  const [sales] = await db.query(
    `SELECT s.id, s.invoice_number, s.total_amount, s.paid_amount,
            s.remaining_amount, s.created_at, c.name AS customer_name
     FROM sales s JOIN customers c ON c.id = s.customer_id
     WHERE s.factory_id = ? AND s.status = 'ACTIVE' AND DATE(s.created_at) = ?
     ORDER BY s.created_at DESC`,
    [factory_id, date]
  );

  return ok(res, { date, summary: summary[0], sales });
};

// GET /api/reports/sales/monthly?year=YYYY&month=MM
const getMonthlySalesReport = async (req, res) => {
  const { factory_id } = req.user;
  const now = new Date();
  const year  = parseInt(req.query.year)  || now.getFullYear();
  const month = parseInt(req.query.month) || now.getMonth() + 1;

  const [summary] = await db.query(
    `SELECT COUNT(*) AS total_bills,
            COALESCE(SUM(total_amount), 0) AS total_sales,
            COALESCE(SUM(paid_amount), 0) AS total_collected,
            COALESCE(SUM(remaining_amount), 0) AS total_outstanding
     FROM sales
     WHERE factory_id = ? AND status = 'ACTIVE'
       AND EXTRACT(YEAR FROM created_at) = ? AND EXTRACT(MONTH FROM created_at) = ?`,
    [factory_id, year, month]
  );

  const [daily] = await db.query(
    `SELECT DATE(created_at) AS day,
            COUNT(*) AS bills,
            COALESCE(SUM(total_amount), 0) AS sales,
            COALESCE(SUM(paid_amount), 0) AS collected
     FROM sales
     WHERE factory_id = ? AND status = 'ACTIVE'
       AND EXTRACT(YEAR FROM created_at) = ? AND EXTRACT(MONTH FROM created_at) = ?
     GROUP BY DATE(created_at) ORDER BY day`,
    [factory_id, year, month]
  );

  return ok(res, { year, month, summary: summary[0], daily });
};

// GET /api/reports/sales/by-product?from=&to=
const getSalesByProduct = async (req, res) => {
  const { factory_id } = req.user;
  const { from, to } = req.query;

  let sql = `SELECT p.name AS product_name, bw.weight_value, bw.unit,
                    COUNT(DISTINCT si.sale_id) AS total_sales,
                    COALESCE(SUM(si.quantity), 0) AS total_quantity,
                    COALESCE(SUM(si.total), 0) AS total_revenue
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             JOIN products p ON p.id = si.product_id
             JOIN bag_weights bw ON bw.id = si.weight_id
             WHERE s.factory_id = ? AND s.status = 'ACTIVE'`;
  const params = [factory_id];
  if (from) { sql += ' AND s.created_at >= ?'; params.push(from); }
  if (to)   { sql += ' AND s.created_at <= ?'; params.push(to); }
  sql += ' GROUP BY p.id, p.name, bw.id, bw.weight_value, bw.unit ORDER BY total_revenue DESC';

  const [rows] = await db.query(sql, params);
  return ok(res, { products: rows });
};

// GET /api/reports/inventory
const getInventoryReport = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    `SELECT p.name AS product_name, p.status AS product_status,
            bw.weight_value, bw.unit,
            COALESCE(i.quantity, 0) AS quantity
     FROM products p
     CROSS JOIN bag_weights bw
     LEFT JOIN inventory i ON i.product_id = p.id AND i.weight_id = bw.id AND i.factory_id = ?
     WHERE p.factory_id = ?
     ORDER BY p.name, bw.weight_value`,
    [factory_id, factory_id]
  );
  return ok(res, { inventory: rows });
};

// GET /api/reports/customer-dues
const getCustomerDuesReport = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    `SELECT c.id, c.name, c.phone,
            COALESCE(SUM(s.remaining_amount), 0) AS outstanding_balance,
            COUNT(s.id) AS unpaid_invoices
     FROM customers c
     LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'ACTIVE' AND s.remaining_amount > 0
     WHERE c.factory_id = ? AND c.is_deleted = FALSE
     GROUP BY c.id, c.name, c.phone
     HAVING COALESCE(SUM(s.remaining_amount), 0) > 0
     ORDER BY outstanding_balance DESC`,
    [factory_id]
  );
  const [total] = await db.query(
    `SELECT COALESCE(SUM(s.remaining_amount), 0) AS total_dues
     FROM sales s JOIN customers c ON c.id = s.customer_id
     WHERE s.factory_id = ? AND s.status = 'ACTIVE' AND c.is_deleted = FALSE`,
    [factory_id]
  );
  return ok(res, { customers: rows, total_dues: total[0].total_dues });
};

// GET /api/reports/supplier-payables
const getSupplierPayablesReport = async (req, res) => {
  const { factory_id } = req.user;
  const [rows] = await db.query(
    `SELECT s.id, s.name, s.phone,
            COALESCE(SUM(p.remaining_amount), 0) AS outstanding_payable,
            COUNT(p.id) AS unpaid_invoices
     FROM suppliers s
     LEFT JOIN purchases p ON p.supplier_id = s.id AND p.status = 'ACTIVE' AND p.remaining_amount > 0
     WHERE s.factory_id = ? AND s.is_deleted = FALSE
     GROUP BY s.id, s.name, s.phone
     HAVING COALESCE(SUM(p.remaining_amount), 0) > 0
     ORDER BY outstanding_payable DESC`,
    [factory_id]
  );
  const [total] = await db.query(
    `SELECT COALESCE(SUM(p.remaining_amount), 0) AS total_payables
     FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.factory_id = ? AND p.status = 'ACTIVE' AND s.is_deleted = FALSE`,
    [factory_id]
  );
  return ok(res, { suppliers: rows, total_payables: total[0].total_payables });
};

// GET /api/reports/cash-flow?from=&to=
const getCashFlowReport = async (req, res) => {
  const { factory_id } = req.user;
  const { from, to } = req.query;

  let sql = `SELECT transaction_type, payment_method,
                    COALESCE(SUM(amount), 0) AS total
             FROM transactions
             WHERE factory_id = ? AND is_deleted = FALSE`;
  const params = [factory_id];
  if (from) { sql += ' AND created_at >= ?'; params.push(from); }
  if (to)   { sql += ' AND created_at <= ?'; params.push(to); }
  sql += ' GROUP BY transaction_type, payment_method';

  const [rows] = await db.query(sql, params);

  const [cash] = await db.query(
    'SELECT balance FROM cash_accounts WHERE factory_id = ?', [factory_id]
  );
  const [banks] = await db.query(
    'SELECT bank_name, balance FROM bank_accounts WHERE factory_id = ? AND is_deleted = FALSE',
    [factory_id]
  );

  return ok(res, {
    flow: rows,
    cash_balance: cash[0]?.balance || 0,
    bank_balances: banks,
  });
};

// GET /api/reports/transactions?from=&to=&type=&method=
const getTransactionReport = async (req, res) => {
  const { factory_id } = req.user;
  const { from, to, type, method } = req.query;

  let sql = `SELECT t.id, t.transaction_type, t.payment_method, t.amount,
                    t.source_type, t.created_at, t.notes,
                    ba.bank_name,
                    CASE t.source_type
                      WHEN 'CUSTOMER' THEN c.name
                      WHEN 'SUPPLIER' THEN s.name
                      ELSE 'System'
                    END AS source_name
             FROM transactions t
             LEFT JOIN bank_accounts ba ON ba.id = t.bank_id
             LEFT JOIN customers c ON t.source_type = 'CUSTOMER' AND c.id = t.source_id
             LEFT JOIN suppliers s ON t.source_type = 'SUPPLIER' AND s.id = t.source_id
             WHERE t.factory_id = ? AND t.is_deleted = FALSE`;
  const params = [factory_id];
  if (type)   { sql += ' AND t.transaction_type = ?'; params.push(type); }
  if (method) { sql += ' AND t.payment_method = ?';   params.push(method); }
  if (from)   { sql += ' AND t.created_at >= ?';      params.push(from); }
  if (to)     { sql += ' AND t.created_at <= ?';      params.push(to); }
  sql += ' ORDER BY t.created_at DESC';

  const [rows] = await db.query(sql, params);

  const [totals] = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN transaction_type = 'IN' THEN amount ELSE 0 END), 0) AS total_in,
       COALESCE(SUM(CASE WHEN transaction_type = 'OUT' THEN amount ELSE 0 END), 0) AS total_out
     FROM transactions WHERE factory_id = ? AND is_deleted = FALSE`,
    [factory_id]
  );

  return ok(res, { transactions: rows, totals: totals[0] });
};

// GET /api/reports/dashboard
const getDashboard = async (req, res) => {
  const { factory_id } = req.user;
  const today = new Date().toISOString().slice(0, 10);

  const [[todaySales], [totalDues], [totalPayables], [cash], [banks], [lowStock]] = await Promise.all([
    db.query(
      `SELECT COUNT(*) AS bills, COALESCE(SUM(total_amount),0) AS sales, COALESCE(SUM(paid_amount),0) AS collected
       FROM sales WHERE factory_id = ? AND status = 'ACTIVE' AND DATE(created_at) = ?`,
      [factory_id, today]
    ),
    db.query(
      `SELECT COALESCE(SUM(remaining_amount),0) AS total FROM sales WHERE factory_id = ? AND status = 'ACTIVE'`,
      [factory_id]
    ),
    db.query(
      `SELECT COALESCE(SUM(remaining_amount),0) AS total FROM purchases WHERE factory_id = ? AND status = 'ACTIVE'`,
      [factory_id]
    ),
    db.query('SELECT balance FROM cash_accounts WHERE factory_id = ?', [factory_id]),
    db.query('SELECT id, bank_name, balance FROM bank_accounts WHERE factory_id = ? AND is_deleted = FALSE', [factory_id]),
    db.query(
      `SELECT i.quantity, p.name AS product_name, bw.weight_value, bw.unit
       FROM inventory i JOIN products p ON p.id = i.product_id JOIN bag_weights bw ON bw.id = i.weight_id
       WHERE i.factory_id = ? AND i.quantity <= 10 AND p.status = 'ACTIVE' ORDER BY i.quantity ASC LIMIT 10`,
      [factory_id]
    ),
  ]);

  const [recentSales] = await db.query(
    `SELECT s.id, s.invoice_number, s.total_amount, s.created_at, c.name AS customer_name
     FROM sales s JOIN customers c ON c.id = s.customer_id
     WHERE s.factory_id = ? AND s.status = 'ACTIVE' ORDER BY s.created_at DESC LIMIT 5`,
    [factory_id]
  );

  return ok(res, {
    today: todaySales[0],
    total_dues: totalDues[0]?.total || 0,
    total_payables: totalPayables[0]?.total || 0,
    cash_balance: cash[0]?.balance || 0,
    bank_balances: banks,
    low_stock: lowStock,
    recent_sales: recentSales,
  });
};

module.exports = {
  getDailySalesReport,
  getMonthlySalesReport,
  getSalesByProduct,
  getInventoryReport,
  getCustomerDuesReport,
  getSupplierPayablesReport,
  getCashFlowReport,
  getTransactionReport,
  getDashboard,
};
