-- Migration: General Expense Manager tables
-- Run against: psql -U postgres -p 5400 -d factory_erp

-- ─────────────────────────────────────────
-- expense_groups
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_groups (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  name       VARCHAR(255) NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- expense_khatas
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_khatas (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  group_id   INT NOT NULL REFERENCES expense_groups(id),
  name       VARCHAR(255) NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- expenses
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id             SERIAL PRIMARY KEY,
  factory_id     INT NOT NULL REFERENCES factories(id),
  group_id       INT NOT NULL REFERENCES expense_groups(id),
  khata_id       INT NOT NULL REFERENCES expense_khatas(id),
  description    TEXT,
  amount         NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(10) NOT NULL CHECK (payment_method IN ('CASH','BANK')),
  bank_id        INT REFERENCES bank_accounts(id),
  expense_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by     INT NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
