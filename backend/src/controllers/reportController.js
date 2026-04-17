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
  // Only return rows that actually have stock (quantity > 0)
  const [rows] = await db.query(
    `SELECT p.name AS product_name, p.status AS product_status,
            bw.weight_value, bw.unit,
            i.quantity,
            (i.quantity * bw.weight_value) AS total_kg
     FROM inventory i
     JOIN products p ON p.id = i.product_id
     JOIN bag_weights bw ON bw.id = i.weight_id
     WHERE i.factory_id = ? AND i.quantity > 0
     ORDER BY p.name, bw.weight_value`,
    [factory_id]
  );

  // Summary per product
  const [summary] = await db.query(
    `SELECT p.name AS product_name,
            SUM(i.quantity) AS total_bags,
            SUM(i.quantity * bw.weight_value) AS total_kg
     FROM inventory i
     JOIN products p ON p.id = i.product_id
     JOIN bag_weights bw ON bw.id = i.weight_id
     WHERE i.factory_id = ? AND i.quantity > 0
     GROUP BY p.id, p.name
     ORDER BY p.name`,
    [factory_id]
  );

  return ok(res, { inventory: rows, summary });
};

// GET /api/reports/customer-dues
const getCustomerDuesReport = async (req, res) => {
  const { factory_id } = req.user;
  const [seasonRows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
  );
  const season_id = seasonRows[0]?.id || null;
  const sf = season_id ? ` AND s.season_id = ${season_id}` : '';

  const [rows] = await db.query(
    `SELECT c.id, c.name, c.phone, c.address,
            COALESCE(SUM(s.remaining_amount), 0) AS outstanding_balance,
            COUNT(s.id) AS unpaid_invoices
     FROM customers c
     LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'ACTIVE' AND s.remaining_amount > 0${sf}
     WHERE c.factory_id = ? AND c.is_deleted = FALSE
     GROUP BY c.id, c.name, c.phone, c.address
     HAVING COALESCE(SUM(s.remaining_amount), 0) > 0
     ORDER BY outstanding_balance DESC`,
    [factory_id]
  );
  const [total] = await db.query(
    `SELECT COALESCE(SUM(s.remaining_amount), 0) AS total_dues
     FROM sales s JOIN customers c ON c.id = s.customer_id
     WHERE s.factory_id = ? AND s.status = 'ACTIVE' AND c.is_deleted = FALSE${season_id ? ' AND s.season_id = ' + season_id : ''}`,
    [factory_id]
  );
  return ok(res, { customers: rows, total_dues: total[0].total_dues });
};

// GET /api/reports/supplier-payables
const getSupplierPayablesReport = async (req, res) => {
  const { factory_id } = req.user;
  const [seasonRows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
  );
  const season_id = seasonRows[0]?.id || null;
  const pf = season_id ? ` AND p.season_id = ${season_id}` : '';

  const [rows] = await db.query(
    `SELECT s.id, s.name, s.phone,
            COALESCE(SUM(p.remaining_amount), 0) AS outstanding_payable,
            COUNT(p.id) AS unpaid_invoices
     FROM suppliers s
     LEFT JOIN purchases p ON p.supplier_id = s.id AND p.status = 'ACTIVE' AND p.remaining_amount > 0${pf}
     WHERE s.factory_id = ? AND s.is_deleted = FALSE
     GROUP BY s.id, s.name, s.phone
     HAVING COALESCE(SUM(p.remaining_amount), 0) > 0
     ORDER BY outstanding_payable DESC`,
    [factory_id]
  );
  const [total] = await db.query(
    `SELECT COALESCE(SUM(p.remaining_amount), 0) AS total_payables
     FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.factory_id = ? AND p.status = 'ACTIVE' AND s.is_deleted = FALSE${season_id ? ' AND p.season_id = ' + season_id : ''}`,
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

  const [seasonRows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
  );
  const season_id = seasonRows[0]?.id || null;
  const seasonFilter = season_id ? ' AND season_id = ' + season_id : '';

  const [[todaySales], [totalDues], [totalPayables], [cash], [banks], [lowStock], [empOutstanding]] = await Promise.all([
    db.query(
      `SELECT COUNT(*) AS bills, COALESCE(SUM(total_amount),0) AS sales, COALESCE(SUM(paid_amount),0) AS collected
       FROM sales WHERE factory_id = ? AND status = 'ACTIVE' AND DATE(created_at) = ?${seasonFilter}`,
      [factory_id, today]
    ),
    db.query(
      `SELECT COALESCE(SUM(remaining_amount),0) AS total FROM sales WHERE factory_id = ? AND status = 'ACTIVE'${seasonFilter}`,
      [factory_id]
    ),
    db.query(
      `SELECT COALESCE(SUM(remaining_amount),0) AS total FROM purchases WHERE factory_id = ? AND status = 'ACTIVE'${seasonFilter}`,
      [factory_id]
    ),
    db.query('SELECT balance FROM cash_accounts WHERE factory_id = ?', [factory_id]),
    db.query('SELECT id, bank_name, account_title, balance FROM bank_accounts WHERE factory_id = ? AND is_deleted = FALSE', [factory_id]),
    db.query(
      `SELECT i.quantity, p.name AS product_name, bw.weight_value, bw.unit
       FROM inventory i JOIN products p ON p.id = i.product_id JOIN bag_weights bw ON bw.id = i.weight_id
       WHERE i.factory_id = ? AND i.quantity <= 10 AND p.status = 'ACTIVE' ORDER BY i.quantity ASC LIMIT 10`,
      [factory_id]
    ),
    db.query(
      `SELECT COALESCE(SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE 0 END) - SUM(CASE WHEN entry_type='DEBIT' THEN amount ELSE 0 END), 0) AS total
       FROM employee_khata_entries WHERE factory_id = ?${seasonFilter}`,
      [factory_id]
    ),
  ]);

  const [recentSales] = await db.query(
    `SELECT s.id, s.invoice_number, s.total_amount, s.created_at, c.name AS customer_name
     FROM sales s JOIN customers c ON c.id = s.customer_id
     WHERE s.factory_id = ? AND s.status = 'ACTIVE'${seasonFilter} ORDER BY s.created_at DESC LIMIT 5`,
    [factory_id]
  );

  return ok(res, {
    today: todaySales[0],
    total_dues: totalDues[0]?.total || 0,
    total_payables: totalPayables[0]?.total || 0,
    employee_outstanding: empOutstanding[0]?.total || 0,
    cash_balance: cash[0]?.balance || 0,
    bank_balances: banks,
    low_stock: lowStock,
    recent_sales: recentSales,
  });
};

// GET /api/reports/individual/product?product_id=&from=&to=
const getIndividualProductReport = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { product_id, from, to } = req.query;
    if (!product_id) return res.status(400).json({ success: false, error: { message: 'product_id is required' } });

    // Get product name for purchase lookup
    const [prodRows] = await db.query('SELECT name FROM products WHERE id = ? AND factory_id = ?', [product_id, factory_id]);
    const productName = prodRows[0]?.name || '';

    // ── Sales query ──
    let salesSql = `SELECT si.quantity, si.price, si.total,
                           bw.weight_value, bw.unit,
                           sal.invoice_number, sal.created_at,
                           c.name AS customer_name
                    FROM sale_items si
                    JOIN sales sal ON sal.id = si.sale_id
                    JOIN bag_weights bw ON bw.id = si.weight_id
                    JOIN customers c ON c.id = sal.customer_id
                    WHERE sal.factory_id = ? AND sal.status = 'ACTIVE' AND si.product_id = ?`;
    const salesParams = [factory_id, product_id];
    if (from) { salesSql += ' AND sal.created_at >= ?'; salesParams.push(from); }
    if (to)   { salesSql += ' AND DATE(sal.created_at) <= ?'; salesParams.push(to); }
    salesSql += ' ORDER BY sal.created_at DESC';

    // ── Purchases query (match by product_name ILIKE) ──
    let purchSql = `SELECT pi.product_name, pi.quantity, pi.unit_price, pi.total,
                           p.invoice_number, p.purchase_date, p.created_at,
                           s.name AS supplier_name
                    FROM purchase_items pi
                    JOIN purchases p ON p.id = pi.purchase_id
                    JOIN suppliers s ON s.id = p.supplier_id
                    WHERE p.factory_id = ? AND p.status = 'ACTIVE'
                      AND pi.product_name ILIKE ?`;
    const purchParams = [factory_id, `%${productName}%`];
    if (from) { purchSql += ' AND p.created_at >= ?'; purchParams.push(from); }
    if (to)   { purchSql += ' AND DATE(p.created_at) <= ?'; purchParams.push(to); }
    purchSql += ' ORDER BY p.created_at DESC';

    const [[salesRows], [purchRows]] = await Promise.all([
      db.query(salesSql, salesParams),
      db.query(purchSql, purchParams),
    ]);

    const salesSummary = {
      total_invoices: new Set(salesRows.map(r => r.invoice_number)).size,
      total_quantity: salesRows.reduce((acc, r) => acc + Number(r.quantity || 0), 0),
      total_revenue:  salesRows.reduce((acc, r) => acc + Number(r.total || 0), 0),
    };

    const purchSummary = {
      total_invoices:  new Set(purchRows.map(r => r.invoice_number)).size,
      total_quantity:  purchRows.reduce((acc, r) => acc + Number(r.quantity || 0), 0),
      total_cost:      purchRows.reduce((acc, r) => acc + Number(r.total || 0), 0),
    };

    return ok(res, { sales: salesRows, summary: salesSummary, purchases: purchRows, purchase_summary: purchSummary, product_name: productName });
  } catch (err) {
    console.error('getIndividualProductReport error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// GET /api/reports/individual/customer?customer_id=&from=&to=
const getIndividualCustomerReport = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { customer_id, from, to } = req.query;
    if (!customer_id) return res.status(400).json({ success: false, error: { message: 'customer_id is required' } });

    const [seasonRows] = await db.query(
      'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
    );
    const season_id = seasonRows[0]?.id || null;

    let sql = `SELECT id, invoice_number, total_amount, paid_amount, remaining_amount, created_at
               FROM sales
               WHERE factory_id = ? AND status = 'ACTIVE' AND customer_id = ?`;
    const params = [factory_id, customer_id];
    if (season_id) { sql += ' AND season_id = ?'; params.push(season_id); }
    if (from) { sql += ' AND created_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND DATE(created_at) <= ?'; params.push(to); }
    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sql, params);

    const summary = {
      total_invoices:    rows.length,
      total_billed:      rows.reduce((acc, r) => acc + Number(r.total_amount || 0), 0),
      total_paid:        rows.reduce((acc, r) => acc + Number(r.paid_amount || 0), 0),
      total_outstanding: rows.reduce((acc, r) => acc + Number(r.remaining_amount || 0), 0),
    };

    return ok(res, { sales: rows, summary });
  } catch (err) {
    console.error('getIndividualCustomerReport error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// GET /api/reports/individual/supplier?supplier_id=&from=&to=
const getIndividualSupplierReport = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { supplier_id, from, to } = req.query;
    if (!supplier_id) return res.status(400).json({ success: false, error: { message: 'supplier_id is required' } });

    const [seasonRows] = await db.query(
      'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
    );
    const season_id = seasonRows[0]?.id || null;

    let sql = `SELECT id, invoice_number, total_amount, paid_amount, remaining_amount, purchase_date, created_at
               FROM purchases
               WHERE factory_id = ? AND status = 'ACTIVE' AND supplier_id = ?`;
    const params = [factory_id, supplier_id];
    if (season_id) { sql += ' AND season_id = ?'; params.push(season_id); }
    if (from) { sql += ' AND created_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND DATE(created_at) <= ?'; params.push(to); }
    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sql, params);

    const summary = {
      total_purchases:   rows.length,
      total_billed:      rows.reduce((acc, r) => acc + Number(r.total_amount || 0), 0),
      total_paid:        rows.reduce((acc, r) => acc + Number(r.paid_amount || 0), 0),
      total_outstanding: rows.reduce((acc, r) => acc + Number(r.remaining_amount || 0), 0),
    };

    return ok(res, { purchases: rows, summary });
  } catch (err) {
    console.error('getIndividualSupplierReport error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// GET /api/reports/individual/bank?bank_id=&from=&to=
const getIndividualBankReport = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { bank_id, from, to } = req.query;
    if (!bank_id) return res.status(400).json({ success: false, error: { message: 'bank_id is required' } });

    let sql = `SELECT t.id, t.transaction_type, t.amount, t.source_type, t.notes, t.created_at,
                      CASE t.source_type
                        WHEN 'CUSTOMER' THEN cust.name
                        WHEN 'SUPPLIER' THEN supp.name
                        ELSE 'System'
                      END AS source_name
               FROM transactions t
               LEFT JOIN customers cust ON t.source_type = 'CUSTOMER' AND cust.id = t.source_id
               LEFT JOIN suppliers supp ON t.source_type = 'SUPPLIER' AND supp.id = t.source_id
               WHERE t.factory_id = ? AND t.bank_id = ? AND t.is_deleted = FALSE`;
    const params = [factory_id, bank_id];
    if (from) { sql += ' AND t.created_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND DATE(t.created_at) <= ?'; params.push(to); }
    sql += ' ORDER BY t.created_at DESC';

    const [rows] = await db.query(sql, params);

    const [bankRows] = await db.query(
      'SELECT balance FROM bank_accounts WHERE id = ? AND factory_id = ?', [bank_id, factory_id]
    );

    const summary = {
      current_balance: bankRows[0]?.balance || 0,
      total_in:  rows.filter(r => r.transaction_type === 'IN').reduce((acc, r) => acc + Number(r.amount || 0), 0),
      total_out: rows.filter(r => r.transaction_type === 'OUT').reduce((acc, r) => acc + Number(r.amount || 0), 0),
    };

    return ok(res, { transactions: rows, summary });
  } catch (err) {
    console.error('getIndividualBankReport error:', err);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// GET /api/reports/mill?from=&to=
const getMillReport = async (req, res) => {
  const { factory_id } = req.user;
  const { from, to } = req.query;

  const [seasonRows] = await db.query(
    'SELECT id FROM seasons WHERE factory_id = ? AND is_active = TRUE LIMIT 1', [factory_id]
  );
  const season_id = seasonRows[0]?.id || null;

  const dateFilter = (col, seasonCol) => {
    let clause = '';
    const p = [];
    if (season_id) { clause += ` AND ${seasonCol} = ${season_id}`; }
    if (from) { clause += ` AND ${col} >= ?`; p.push(from); }
    if (to)   { clause += ` AND DATE(${col}) <= ?`; p.push(to); }
    return { clause, p };
  };

  const sf = dateFilter('s.created_at', 's.season_id');
  const pf = dateFilter('p.created_at', 'p.season_id');
  const ef = dateFilter('e.expense_date', 'e.season_id');
  const spf = dateFilter('sp.created_at', 'sp.season_id');

  const [[salesRow], [purchasesRow], [expensesRow], [salariesRow], [expenseBreakdown], [expenseByGroup]] = await Promise.all([
    // Total sales revenue
    db.query(
      `SELECT COALESCE(SUM(s.total_amount),0) AS total_sales,
              COALESCE(SUM(s.paid_amount),0) AS total_collected,
              COALESCE(SUM(s.remaining_amount),0) AS total_outstanding,
              COUNT(*) AS total_invoices
       FROM sales s WHERE s.factory_id = ? AND s.status = 'ACTIVE'${sf.clause}`,
      [factory_id, ...sf.p]
    ),
    // Total purchases
    db.query(
      `SELECT COALESCE(SUM(p.total_amount),0) AS total_purchases,
              COALESCE(SUM(p.paid_amount),0) AS total_paid,
              COALESCE(SUM(p.remaining_amount),0) AS total_payable,
              COUNT(*) AS total_invoices
       FROM purchases p WHERE p.factory_id = ? AND p.status = 'ACTIVE'${pf.clause}`,
      [factory_id, ...pf.p]
    ),
    // Total general expenses
    db.query(
      `SELECT COALESCE(SUM(e.amount),0) AS total_expenses, COUNT(*) AS total_count
       FROM expenses e WHERE e.factory_id = ?${ef.clause}`,
      [factory_id, ...ef.p]
    ),
    // Total salaries paid
    db.query(
      `SELECT COALESCE(SUM(sp.amount),0) AS total_salaries, COUNT(*) AS total_payments
       FROM employee_salary_payments sp WHERE sp.factory_id = ?${spf.clause}`,
      [factory_id, ...spf.p]
    ),
    // Expense breakdown by group
    db.query(
      `SELECT eg.name AS group_name, COALESCE(SUM(e.amount),0) AS total
       FROM expenses e
       JOIN expense_groups eg ON eg.id = e.group_id
       WHERE e.factory_id = ?${ef.clause}
       GROUP BY eg.id, eg.name ORDER BY total DESC`,
      [factory_id, ...ef.p]
    ),
    // Expense breakdown by group+khata
    db.query(
      `SELECT eg.name AS group_name, ek.name AS khata_name, COALESCE(SUM(e.amount),0) AS total
       FROM expenses e
       JOIN expense_groups eg ON eg.id = e.group_id
       JOIN expense_khatas ek ON ek.id = e.khata_id
       WHERE e.factory_id = ?${ef.clause}
       GROUP BY eg.id, eg.name, ek.id, ek.name ORDER BY eg.name, total DESC`,
      [factory_id, ...ef.p]
    ),
  ]);

  const totalRevenue   = Number(salesRow[0]?.total_sales    || 0);
  const totalPurchases = Number(purchasesRow[0]?.total_purchases || 0);
  const totalExpenses  = Number(expensesRow[0]?.total_expenses  || 0);
  const totalSalaries  = Number(salariesRow[0]?.total_salaries  || 0);
  const totalProfit    = totalRevenue - totalPurchases - totalExpenses - totalSalaries;

  return ok(res, {
    summary: {
      total_revenue:   totalRevenue,
      total_purchases: totalPurchases,
      total_expenses:  totalExpenses,
      total_salaries:  totalSalaries,
      total_profit:    totalProfit,
    },
    sales:    salesRow[0],
    purchases: purchasesRow[0],
    expenses:  expensesRow[0],
    salaries:  salariesRow[0],
    expense_by_group: expenseBreakdown,
    expense_by_khata: expenseByGroup,
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
  getIndividualProductReport,
  getIndividualCustomerReport,
  getIndividualSupplierReport,
  getIndividualBankReport,
  getMillReport,
};
