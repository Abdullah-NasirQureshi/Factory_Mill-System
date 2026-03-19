-- Migration: Employee Management & Employee Khata System
-- Run against: psql -U postgres -p 5400 -d factory_erp

-- ─────────────────────────────────────────
-- employees
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id             SERIAL PRIMARY KEY,
  factory_id     INT NOT NULL REFERENCES factories(id),
  name           VARCHAR(255) NOT NULL,
  phone          VARCHAR(50),
  address        TEXT,
  monthly_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- employee_khata_entries
-- entry_type: DEBIT = employee receives value (salary earned / cash repayment)
--             CREDIT = mill gives cash out (loan / salary paid in cash)
-- has_cash_movement: FALSE for salary-earned debits (no cash changes hands)
-- outstanding = SUM(CREDIT) - SUM(DEBIT)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_khata_entries (
  id               SERIAL PRIMARY KEY,
  factory_id       INT NOT NULL REFERENCES factories(id),
  employee_id      INT NOT NULL REFERENCES employees(id),
  entry_type       VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
  amount           NUMERIC(10,2) NOT NULL,
  description      TEXT,
  has_cash_movement BOOLEAN DEFAULT TRUE,
  payment_method   VARCHAR(10) CHECK (payment_method IN ('CASH','BANK')),
  bank_id          INT REFERENCES bank_accounts(id),
  entry_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_id   INT REFERENCES transactions(id),
  created_by       INT NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- employee_salary_payments
-- Each salary payment auto-posts a CREDIT in employee_khata_entries
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_salary_payments (
  id           SERIAL PRIMARY KEY,
  factory_id   INT NOT NULL REFERENCES factories(id),
  employee_id  INT NOT NULL REFERENCES employees(id),
  salary_month DATE NOT NULL,          -- stored as first day of month
  amount       NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(10) NOT NULL CHECK (payment_method IN ('CASH','BANK')),
  bank_id      INT REFERENCES bank_accounts(id),
  notes        TEXT,
  khata_entry_id INT REFERENCES employee_khata_entries(id),
  transaction_id INT REFERENCES transactions(id),
  created_by   INT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
