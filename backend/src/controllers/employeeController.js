const db = require('../config/db');
const { ok, fail } = require('../utils/response');
const { nextDocNumber } = require('../utils/docNumber');

// ─── EMPLOYEE CRUD ────────────────────────────────────────────────────────────

// GET /api/employees
const getEmployees = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { search, active } = req.query;
    let sql = `
      SELECT e.*,
        COALESCE(
          (SELECT SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE -amount END)
           FROM employee_khata_entries
           WHERE employee_id = e.id AND factory_id = e.factory_id), 0
        ) AS outstanding_balance
      FROM employees e
      WHERE e.factory_id = ?`;
    const params = [factory_id];
    if (active !== undefined) { sql += ' AND e.is_active = ?'; params.push(active === 'true'); }
    if (search) {
      sql += ' AND (e.name ILIKE ? OR e.phone ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY e.name';
    const [rows] = await db.query(sql, params);
    return ok(res, { employees: rows });
  } catch (e) {
    console.error('getEmployees error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// GET /api/employees/:id
const getEmployee = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT e.*,
         COALESCE(
           (SELECT SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE -amount END)
            FROM employee_khata_entries
            WHERE employee_id = e.id AND factory_id = e.factory_id), 0
         ) AS outstanding_balance
       FROM employees e
       WHERE e.id = ? AND e.factory_id = ?`,
      [id, factory_id]
    );
    if (!rows[0]) return fail(res, 'NOT_FOUND', 'Employee not found', 404);
    return ok(res, { employee: rows[0] });
  } catch (e) {
    console.error('getEmployee error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// POST /api/employees
const createEmployee = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { name, phone, address, monthly_salary } = req.body;
    if (!name || !name.trim()) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Name is required');
    const [, , result] = await db.query(
      'INSERT INTO employees (factory_id, name, phone, address, monthly_salary) VALUES (?, ?, ?, ?, ?)',
      [factory_id, name.trim(), phone || null, address || null, monthly_salary || 0]
    );
    return ok(res, { employee: { id: result.insertId, name: name.trim(), phone, address, monthly_salary: monthly_salary || 0, is_active: true } }, 201);
  } catch (e) {
    console.error('createEmployee error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// PUT /api/employees/:id
const updateEmployee = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { id } = req.params;
    const { name, phone, address, monthly_salary, is_active } = req.body;
    const [existing] = await db.query('SELECT id FROM employees WHERE id = ? AND factory_id = ?', [id, factory_id]);
    if (!existing[0]) return fail(res, 'NOT_FOUND', 'Employee not found', 404);
    const fields = [], vals = [];
    if (name !== undefined)           { fields.push('name = ?');           vals.push(name.trim()); }
    if (phone !== undefined)          { fields.push('phone = ?');          vals.push(phone); }
    if (address !== undefined)        { fields.push('address = ?');        vals.push(address); }
    if (monthly_salary !== undefined) { fields.push('monthly_salary = ?'); vals.push(monthly_salary); }
    if (is_active !== undefined)      { fields.push('is_active = ?');      vals.push(is_active); }
    if (!fields.length) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'Nothing to update');
    vals.push(id, factory_id);
    await db.query('UPDATE employees SET ' + fields.join(', ') + ' WHERE id = ? AND factory_id = ?', vals);
    return ok(res, { message: 'Employee updated' });
  } catch (e) {
    console.error('updateEmployee error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// DELETE /api/employees/:id
const deleteEmployee = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { id } = req.params;
    const [existing] = await db.query('SELECT id FROM employees WHERE id = ? AND factory_id = ?', [id, factory_id]);
    if (!existing[0]) return fail(res, 'NOT_FOUND', 'Employee not found', 404);
    const [used] = await db.query(
      `SELECT (SELECT COUNT(*) FROM employee_khata_entries WHERE employee_id = ? AND factory_id = ?) +
              (SELECT COUNT(*) FROM employee_salary_payments WHERE employee_id = ? AND factory_id = ?) AS cnt`,
      [id, factory_id, id, factory_id]
    );
    if (parseInt(used[0].cnt) > 0) {
      await db.query('UPDATE employees SET is_active = false WHERE id = ? AND factory_id = ?', [id, factory_id]);
    } else {
      await db.query('DELETE FROM employees WHERE id = ? AND factory_id = ?', [id, factory_id]);
    }
    return ok(res, { message: 'Employee deleted' });
  } catch (e) {
    console.error('deleteEmployee error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// ─── KHATA ENTRIES ───────────────────────────────────────────────────────────

// GET /api/employees/:id/khata
const getKhata = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT k.*,
         ba.bank_name,
         SUM(CASE WHEN k2.entry_type='CREDIT' THEN k2.amount ELSE -k2.amount END)
           OVER (PARTITION BY k.employee_id ORDER BY k.entry_date, k.created_at
                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
       FROM employee_khata_entries k
       LEFT JOIN bank_accounts ba ON ba.id = k.bank_id
       JOIN employee_khata_entries k2 ON k2.id = k.id
       WHERE k.employee_id = ? AND k.factory_id = ?
       ORDER BY k.entry_date ASC, k.created_at ASC`,
      [id, factory_id]
    );
    return ok(res, { entries: rows });
  } catch (e) {
    console.error('getKhata error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// POST /api/employees/:id/khata
const createKhataEntry = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { id: employee_id } = req.params;
  const { entry_type, amount, description, has_cash_movement, payment_method, bank_id, entry_date } = req.body;

  if (!entry_type || !amount) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'entry_type and amount are required');
  if (!['DEBIT', 'CREDIT'].includes(entry_type)) return fail(res, 'VALIDATION_INVALID_FORMAT', 'entry_type must be DEBIT or CREDIT');
  if (Number(amount) <= 0) return fail(res, 'VALIDATION_INVALID_FORMAT', 'Amount must be positive');

  const cashMoves = has_cash_movement !== false && has_cash_movement !== 'false';
  // CREDIT always moves cash; DEBIT only moves cash if has_cash_movement = true
  const needsCash = entry_type === 'CREDIT' || (entry_type === 'DEBIT' && cashMoves);

  if (needsCash) {
    if (!payment_method || !['CASH', 'BANK'].includes(payment_method))
      return fail(res, 'VALIDATION_REQUIRED_FIELD', 'payment_method (CASH or BANK) is required for cash movements');
    if (payment_method === 'BANK' && !bank_id)
      return fail(res, 'VALIDATION_REQUIRED_FIELD', 'bank_id is required when payment_method is BANK');
  }

  const [emp] = await db.query('SELECT id FROM employees WHERE id = ? AND factory_id = ?', [employee_id, factory_id]);
  if (!emp[0]) return fail(res, 'NOT_FOUND', 'Employee not found', 404);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let transaction_id = null;

    if (needsCash) {
      if (payment_method === 'CASH') {
        const [cash] = await conn.query('SELECT balance FROM cash_accounts WHERE factory_id = ?', [factory_id]);
        if (!cash[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Cash account not found', 404); }
        if (entry_type === 'CREDIT' && parseFloat(cash[0].balance) < parseFloat(amount)) {
          await conn.rollback(); return fail(res, 'BUSINESS_NEGATIVE_BALANCE', 'Insufficient cash balance');
        }
        const delta = entry_type === 'CREDIT' ? -amount : amount;
        await conn.query('UPDATE cash_accounts SET balance = balance + ? WHERE factory_id = ?', [delta, factory_id]);
      } else {
        const [bank] = await conn.query('SELECT balance FROM bank_accounts WHERE id = ? AND factory_id = ?', [bank_id, factory_id]);
        if (!bank[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Bank account not found', 404); }
        if (entry_type === 'CREDIT' && parseFloat(bank[0].balance) < parseFloat(amount)) {
          await conn.rollback(); return fail(res, 'BUSINESS_NEGATIVE_BALANCE', 'Insufficient bank balance');
        }
        const delta = entry_type === 'CREDIT' ? -amount : amount;
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ? AND factory_id = ?', [delta, bank_id, factory_id]);
      }

      // Create transaction record + PV number
      const pv = await nextDocNumber(conn, factory_id, 'PV');
      const txType = entry_type === 'CREDIT' ? 'OUT' : 'IN';
      const [, , txResult] = await conn.query(
        `INSERT INTO transactions (factory_id, transaction_type, source_type, source_id, payment_method, bank_id, amount, voucher_number, notes)
         VALUES (?, ?, 'EMPLOYEE', ?, ?, ?, ?, ?, ?)`,
        [factory_id, txType, employee_id, payment_method, bank_id || null, amount, pv,
         description || (entry_type === 'CREDIT' ? 'Employee advance/loan' : 'Employee cash repayment')]
      );
      transaction_id = txResult.insertId;
    }

    const [, , entryResult] = await conn.query(
      `INSERT INTO employee_khata_entries
         (factory_id, employee_id, entry_type, amount, description, has_cash_movement, payment_method, bank_id, entry_date, transaction_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [factory_id, employee_id, entry_type, amount, description || null,
       needsCash, needsCash ? payment_method : null, needsCash ? (bank_id || null) : null,
       entry_date || new Date().toISOString().slice(0, 10), transaction_id, user_id]
    );

    await conn.commit();
    return ok(res, { entry: { id: entryResult.insertId, transaction_id } }, 201);
  } catch (e) {
    await conn.rollback();
    console.error('createKhataEntry error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  } finally {
    conn.release();
  }
};

// DELETE /api/employees/:id/khata/:entryId
const deleteKhataEntry = async (req, res) => {
  const { factory_id } = req.user;
  const { id: employee_id, entryId } = req.params;
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT * FROM employee_khata_entries WHERE id = ? AND employee_id = ? AND factory_id = ?',
      [entryId, employee_id, factory_id]
    );
    if (!rows[0]) return fail(res, 'NOT_FOUND', 'Entry not found', 404);
    const entry = rows[0];

    await conn.beginTransaction();

    if (entry.has_cash_movement) {
      // Reverse the cash/bank movement
      const delta = entry.entry_type === 'CREDIT' ? entry.amount : -entry.amount;
      if (entry.payment_method === 'CASH') {
        await conn.query('UPDATE cash_accounts SET balance = balance + ? WHERE factory_id = ?', [delta, factory_id]);
      } else {
        await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ? AND factory_id = ?', [delta, entry.bank_id, factory_id]);
      }
      // Null out FK reference before deleting the transaction
      if (entry.transaction_id) {
        await conn.query('UPDATE employee_khata_entries SET transaction_id = NULL WHERE transaction_id = ?', [entry.transaction_id]);
      }
    }

    await conn.query('DELETE FROM employee_khata_entries WHERE id = ?', [entryId]);

    // Now safe to delete the transaction (no FK references remain)
    if (entry.has_cash_movement && entry.transaction_id) {
      await conn.query('DELETE FROM transactions WHERE id = ?', [entry.transaction_id]);
    }
    await conn.commit();
    return ok(res, { message: 'Entry deleted and balance reversed' });
  } catch (e) {
    await conn.rollback();
    console.error('deleteKhataEntry error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  } finally {
    conn.release();
  }
};

// ─── SALARY PAYMENTS ─────────────────────────────────────────────────────────

// GET /api/salary  (factory-wide, optional ?employee_id= ?month=)
const getSalaryPayments = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { employee_id, month } = req.query;
    let sql = `SELECT sp.*, e.name AS employee_name, ba.bank_name
               FROM employee_salary_payments sp
               JOIN employees e ON e.id = sp.employee_id
               LEFT JOIN bank_accounts ba ON ba.id = sp.bank_id
               WHERE sp.factory_id = ?`;
    const params = [factory_id];
    if (employee_id) { sql += ' AND sp.employee_id = ?'; params.push(employee_id); }
    if (month)       { sql += ' AND TO_CHAR(sp.salary_month, \'YYYY-MM\') = ?'; params.push(month); }
    sql += ' ORDER BY sp.salary_month DESC, sp.created_at DESC';
    const [rows] = await db.query(sql, params);
    return ok(res, { payments: rows });
  } catch (e) {
    console.error('getSalaryPayments error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// GET /api/employees/:id/salary
const getEmployeeSalary = async (req, res) => {
  try {
    const { factory_id } = req.user;
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT sp.*, ba.bank_name
       FROM employee_salary_payments sp
       LEFT JOIN bank_accounts ba ON ba.id = sp.bank_id
       WHERE sp.employee_id = ? AND sp.factory_id = ?
       ORDER BY sp.salary_month DESC`,
      [id, factory_id]
    );
    return ok(res, { payments: rows });
  } catch (e) {
    console.error('getEmployeeSalary error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  }
};

// POST /api/employees/:id/salary
const createSalaryPayment = async (req, res) => {
  const { factory_id, id: user_id } = req.user;
  const { id: employee_id } = req.params;
  const { salary_month, amount, payment_method, bank_id, notes } = req.body;

  if (!salary_month || !amount || !payment_method)
    return fail(res, 'VALIDATION_REQUIRED_FIELD', 'salary_month, amount, payment_method are required');
  if (Number(amount) <= 0) return fail(res, 'VALIDATION_INVALID_FORMAT', 'Amount must be positive');
  if (!['CASH', 'BANK'].includes(payment_method)) return fail(res, 'VALIDATION_INVALID_FORMAT', 'payment_method must be CASH or BANK');
  if (payment_method === 'BANK' && !bank_id) return fail(res, 'VALIDATION_REQUIRED_FIELD', 'bank_id required for BANK payment');

  const [emp] = await db.query('SELECT id, name FROM employees WHERE id = ? AND factory_id = ?', [employee_id, factory_id]);
  if (!emp[0]) return fail(res, 'NOT_FOUND', 'Employee not found', 404);

  // Format month label e.g. "March 2026"
  const monthDate = new Date(salary_month);
  const monthLabel = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Deduct from cash or bank
    if (payment_method === 'CASH') {
      const [cash] = await conn.query('SELECT balance FROM cash_accounts WHERE factory_id = ?', [factory_id]);
      if (!cash[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Cash account not found', 404); }
      if (parseFloat(cash[0].balance) < parseFloat(amount)) {
        await conn.rollback(); return fail(res, 'BUSINESS_NEGATIVE_BALANCE', 'Insufficient cash balance');
      }
      await conn.query('UPDATE cash_accounts SET balance = balance - ? WHERE factory_id = ?', [amount, factory_id]);
    } else {
      const [bank] = await conn.query('SELECT balance FROM bank_accounts WHERE id = ? AND factory_id = ?', [bank_id, factory_id]);
      if (!bank[0]) { await conn.rollback(); return fail(res, 'NOT_FOUND', 'Bank account not found', 404); }
      if (parseFloat(bank[0].balance) < parseFloat(amount)) {
        await conn.rollback(); return fail(res, 'BUSINESS_NEGATIVE_BALANCE', 'Insufficient bank balance');
      }
      await conn.query('UPDATE bank_accounts SET balance = balance - ? WHERE id = ? AND factory_id = ?', [amount, bank_id, factory_id]);
    }

    // Create transaction record with PV number
    const pv = await nextDocNumber(conn, factory_id, 'PV');
    const txNote = `Salary: ${monthLabel}${notes ? ' — ' + notes : ''}`;
    const [, , txResult] = await conn.query(
      `INSERT INTO transactions (factory_id, transaction_type, source_type, source_id, payment_method, bank_id, amount, voucher_number, notes)
       VALUES (?, 'OUT', 'EMPLOYEE', ?, ?, ?, ?, ?, ?)`,
      [factory_id, employee_id, payment_method, bank_id || null, amount, pv, txNote]
    );
    const transaction_id = txResult.insertId;

    // Auto-post DEBIT entry (salary earned — no cash movement, offsets the credit)
    const [, , debitResult] = await conn.query(
      `INSERT INTO employee_khata_entries
         (factory_id, employee_id, entry_type, amount, description, has_cash_movement, payment_method, bank_id, entry_date, transaction_id, created_by)
       VALUES (?, ?, 'DEBIT', ?, ?, FALSE, NULL, NULL, CURRENT_DATE, NULL, ?)`,
      [factory_id, employee_id, amount, `Salary earned: ${monthLabel}`, user_id]
    );
    const debit_khata_entry_id = debitResult.insertId;

    // Auto-post CREDIT entry in employee's khata (mill gave cash out)
    const [, , khataResult] = await conn.query(
      `INSERT INTO employee_khata_entries
         (factory_id, employee_id, entry_type, amount, description, has_cash_movement, payment_method, bank_id, entry_date, transaction_id, created_by)
       VALUES (?, ?, 'CREDIT', ?, ?, TRUE, ?, ?, CURRENT_DATE, ?, ?)`,
      [factory_id, employee_id, amount, `Salary paid: ${monthLabel}`, payment_method, bank_id || null, transaction_id, user_id]
    );
    const khata_entry_id = khataResult.insertId;

    // Record salary payment
    const [, , spResult] = await conn.query(
      `INSERT INTO employee_salary_payments
         (factory_id, employee_id, salary_month, amount, payment_method, bank_id, notes, khata_entry_id, debit_khata_entry_id, transaction_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [factory_id, employee_id, salary_month, amount, payment_method, bank_id || null, notes || null, khata_entry_id, debit_khata_entry_id, transaction_id, user_id]
    );

    await conn.commit();
    return ok(res, { payment: { id: spResult.insertId, voucher_number: pv } }, 201);
  } catch (e) {
    await conn.rollback();
    console.error('createSalaryPayment error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  } finally {
    conn.release();
  }
};

// DELETE /api/employees/:id/salary/:paymentId
const deleteSalaryPayment = async (req, res) => {
  const { factory_id } = req.user;
  const { id: employee_id, paymentId } = req.params;
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      'SELECT * FROM employee_salary_payments WHERE id = ? AND employee_id = ? AND factory_id = ?',
      [paymentId, employee_id, factory_id]
    );
    if (!rows[0]) return fail(res, 'NOT_FOUND', 'Salary payment not found', 404);
    const sp = rows[0];

    await conn.beginTransaction();

    // Reverse cash/bank
    if (sp.payment_method === 'CASH') {
      await conn.query('UPDATE cash_accounts SET balance = balance + ? WHERE factory_id = ?', [sp.amount, factory_id]);
    } else {
      await conn.query('UPDATE bank_accounts SET balance = balance + ? WHERE id = ? AND factory_id = ?', [sp.amount, sp.bank_id, factory_id]);
    }

    // Delete linked khata entries (both credit and debit) and transaction
    if (sp.khata_entry_id) {
      await conn.query('DELETE FROM employee_khata_entries WHERE id = ?', [sp.khata_entry_id]);
    }
    if (sp.debit_khata_entry_id) {
      await conn.query('DELETE FROM employee_khata_entries WHERE id = ?', [sp.debit_khata_entry_id]);
    }
    if (sp.transaction_id) {
      await conn.query('DELETE FROM transactions WHERE id = ?', [sp.transaction_id]);
    }
    await conn.query('DELETE FROM employee_salary_payments WHERE id = ?', [paymentId]);

    await conn.commit();
    return ok(res, { message: 'Salary payment deleted and balance reversed' });
  } catch (e) {
    await conn.rollback();
    console.error('deleteSalaryPayment error:', e);
    return fail(res, 'SERVER_ERROR', e.message, 500);
  } finally {
    conn.release();
  }
};

module.exports = {
  getEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee,
  getKhata, createKhataEntry, deleteKhataEntry,
  getSalaryPayments, getEmployeeSalary, createSalaryPayment, deleteSalaryPayment,
};
