-- =============================================================================
-- Factory Mill ERP — Full Schema + Seed (PostgreSQL)
-- Single file, idempotent — safe to run on a brand new DB or an existing one.
-- Run: psql -U postgres -p 5400 -d factory_erp -f 000_full_schema_seed.sql
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. factories
CREATE TABLE IF NOT EXISTS factories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  address    TEXT,
  phone      VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  factory_id    INT NOT NULL REFERENCES factories(id),
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','ACCOUNTANT')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. customers
CREATE TABLE IF NOT EXISTS customers (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(20),
  address    TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(20),
  address    TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. products
CREATE TABLE IF NOT EXISTS products (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  name       VARCHAR(255) NOT NULL,
  status     VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. bag_weights
CREATE TABLE IF NOT EXISTS bag_weights (
  id           SERIAL PRIMARY KEY,
  weight_value NUMERIC(10,2) NOT NULL,
  unit         VARCHAR(10) DEFAULT 'kg',
  UNIQUE (weight_value, unit)
);

-- 7. inventory
CREATE TABLE IF NOT EXISTS inventory (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  product_id INT NOT NULL REFERENCES products(id),
  weight_id  INT NOT NULL REFERENCES bag_weights(id),
  quantity   NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (factory_id, product_id, weight_id)
);

-- 8. document_sequences
CREATE TABLE IF NOT EXISTS document_sequences (
  id            SERIAL PRIMARY KEY,
  factory_id    INT NOT NULL REFERENCES factories(id),
  document_type VARCHAR(5) NOT NULL CHECK (document_type IN ('SI','PI','PV','JV','GP')),
  last_sequence INT DEFAULT 0,
  UNIQUE (factory_id, document_type)
);

-- 9. bank_accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id             SERIAL PRIMARY KEY,
  factory_id     INT NOT NULL REFERENCES factories(id),
  bank_name      VARCHAR(255) NOT NULL,
  account_title  VARCHAR(255) NOT NULL,
  account_number VARCHAR(50)  NOT NULL,
  balance        NUMERIC(10,2) DEFAULT 0,
  is_deleted     BOOLEAN DEFAULT FALSE,
  deleted_at     TIMESTAMPTZ,
  deleted_by     INT REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 10. cash_accounts
CREATE TABLE IF NOT EXISTS cash_accounts (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL UNIQUE REFERENCES factories(id),
  balance    NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. seasons
CREATE TABLE IF NOT EXISTS seasons (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  name       VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE,
  is_active  BOOLEAN DEFAULT TRUE,
  closed_at  TIMESTAMPTZ,
  closed_by  INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active season per factory at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_season
  ON seasons (factory_id) WHERE is_active = TRUE;

-- 12. season_opening_balances
CREATE TABLE IF NOT EXISTS season_opening_balances (
  id          SERIAL PRIMARY KEY,
  season_id   INT NOT NULL REFERENCES seasons(id),
  factory_id  INT NOT NULL REFERENCES factories(id),
  entity_type VARCHAR(10) NOT NULL CHECK (entity_type IN ('CUSTOMER','SUPPLIER','EMPLOYEE','BANK','CASH')),
  entity_id   INT NOT NULL,
  balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (season_id, entity_type, entity_id)
);

-- 13. sales
CREATE TABLE IF NOT EXISTS sales (
  id               SERIAL PRIMARY KEY,
  factory_id       INT NOT NULL REFERENCES factories(id),
  customer_id      INT NOT NULL REFERENCES customers(id),
  invoice_number   VARCHAR(50) NOT NULL UNIQUE,
  total_amount     NUMERIC(10,2) NOT NULL,
  paid_amount      NUMERIC(10,2) DEFAULT 0,
  remaining_amount NUMERIC(10,2) NOT NULL,
  created_by       INT NOT NULL REFERENCES users(id),
  status           VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVERTED')),
  is_deleted       BOOLEAN DEFAULT FALSE,
  deleted_at       TIMESTAMPTZ,
  deleted_by       INT REFERENCES users(id),
  season_id        INT REFERENCES seasons(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 14. sale_items
CREATE TABLE IF NOT EXISTS sale_items (
  id         SERIAL PRIMARY KEY,
  sale_id    INT NOT NULL REFERENCES sales(id),
  product_id INT NOT NULL REFERENCES products(id),
  weight_id  INT NOT NULL REFERENCES bag_weights(id),
  quantity   NUMERIC(10,2) NOT NULL,
  price      NUMERIC(10,2) NOT NULL,
  total      NUMERIC(10,2) NOT NULL
);

-- 15. purchases
CREATE TABLE IF NOT EXISTS purchases (
  id               SERIAL PRIMARY KEY,
  factory_id       INT NOT NULL REFERENCES factories(id),
  supplier_id      INT NOT NULL REFERENCES suppliers(id),
  invoice_number   VARCHAR(50) NOT NULL UNIQUE,
  total_amount     NUMERIC(10,2) NOT NULL,
  paid_amount      NUMERIC(10,2) DEFAULT 0,
  remaining_amount NUMERIC(10,2) NOT NULL,
  purchase_date    DATE NOT NULL,
  created_by       INT NOT NULL REFERENCES users(id),
  status           VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVERTED')),
  is_deleted       BOOLEAN DEFAULT FALSE,
  deleted_at       TIMESTAMPTZ,
  deleted_by       INT REFERENCES users(id),
  season_id        INT REFERENCES seasons(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 16. purchase_items
CREATE TABLE IF NOT EXISTS purchase_items (
  id           SERIAL PRIMARY KEY,
  purchase_id  INT NOT NULL REFERENCES purchases(id),
  product_name VARCHAR(255) NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL,
  unit_price   NUMERIC(10,2) NOT NULL,
  total        NUMERIC(10,2) NOT NULL
);

-- 17. payments
CREATE TABLE IF NOT EXISTS payments (
  id             SERIAL PRIMARY KEY,
  factory_id     INT NOT NULL REFERENCES factories(id),
  voucher_number VARCHAR(50) NOT NULL UNIQUE,
  type           VARCHAR(20) NOT NULL CHECK (type IN ('CUSTOMER_PAYMENT','SUPPLIER_PAYMENT')),
  reference_id   INT NOT NULL,
  payment_method VARCHAR(10) NOT NULL CHECK (payment_method IN ('CASH','BANK')),
  bank_id        INT REFERENCES bank_accounts(id),
  amount         NUMERIC(10,2) NOT NULL,
  notes          TEXT,
  created_by     INT NOT NULL REFERENCES users(id),
  status         VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVERTED')),
  is_deleted     BOOLEAN DEFAULT FALSE,
  deleted_at     TIMESTAMPTZ,
  deleted_by     INT REFERENCES users(id),
  season_id      INT REFERENCES seasons(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 18. payment_allocations
CREATE TABLE IF NOT EXISTS payment_allocations (
  id               SERIAL PRIMARY KEY,
  payment_id       INT NOT NULL REFERENCES payments(id),
  reference_type   VARCHAR(10) NOT NULL CHECK (reference_type IN ('SALE','PURCHASE')),
  reference_id     INT NOT NULL,
  allocated_amount NUMERIC(10,2) NOT NULL
);

-- 19. transactions
CREATE TABLE IF NOT EXISTS transactions (
  id               SERIAL PRIMARY KEY,
  factory_id       INT NOT NULL REFERENCES factories(id),
  voucher_number   VARCHAR(50) UNIQUE,
  transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('IN','OUT','ADJUST','REVERSAL')),
  source_type      VARCHAR(10) NOT NULL CHECK (source_type IN ('CUSTOMER','SUPPLIER','SYSTEM','EMPLOYEE','EXPENSE','SALARY')),
  source_id        INT,
  payment_method   VARCHAR(10) NOT NULL CHECK (payment_method IN ('CASH','BANK','NONE')),
  bank_id          INT REFERENCES bank_accounts(id),
  amount           NUMERIC(10,2) NOT NULL,
  reference_id     INT,
  notes            TEXT,
  is_deleted       BOOLEAN DEFAULT FALSE,
  deleted_at       TIMESTAMPTZ,
  deleted_by       INT REFERENCES users(id),
  season_id        INT REFERENCES seasons(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 20. stock_transactions
CREATE TABLE IF NOT EXISTS stock_transactions (
  id           SERIAL PRIMARY KEY,
  factory_id   INT NOT NULL REFERENCES factories(id),
  product_id   INT NOT NULL REFERENCES products(id),
  weight_id    INT NOT NULL REFERENCES bag_weights(id),
  type         VARCHAR(10) NOT NULL CHECK (type IN ('ADD','SALE','ADJUST')),
  quantity     NUMERIC(10,2) NOT NULL,
  reference_id INT,
  note         TEXT,
  season_id    INT REFERENCES seasons(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 21. settings
CREATE TABLE IF NOT EXISTS settings (
  id             SERIAL PRIMARY KEY,
  factory_id     INT NOT NULL UNIQUE REFERENCES factories(id),
  company_name   VARCHAR(255),
  company_logo   VARCHAR(500),
  address        TEXT,
  phone          VARCHAR(20),
  invoice_footer TEXT
);

-- 22. expense_groups
CREATE TABLE IF NOT EXISTS expense_groups (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  name       VARCHAR(255) NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. expense_khatas
CREATE TABLE IF NOT EXISTS expense_khatas (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  group_id   INT NOT NULL REFERENCES expense_groups(id),
  name       VARCHAR(255) NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. expenses
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
  season_id      INT REFERENCES seasons(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 25. employees
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

-- 26. employee_khata_entries
CREATE TABLE IF NOT EXISTS employee_khata_entries (
  id                SERIAL PRIMARY KEY,
  factory_id        INT NOT NULL REFERENCES factories(id),
  employee_id       INT NOT NULL REFERENCES employees(id),
  entry_type        VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
  amount            NUMERIC(10,2) NOT NULL,
  description       TEXT,
  has_cash_movement BOOLEAN DEFAULT TRUE,
  payment_method    VARCHAR(10) CHECK (payment_method IN ('CASH','BANK')),
  bank_id           INT REFERENCES bank_accounts(id),
  entry_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_id    INT REFERENCES transactions(id),
  created_by        INT NOT NULL REFERENCES users(id),
  season_id         INT REFERENCES seasons(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 27. employee_salary_payments
CREATE TABLE IF NOT EXISTS employee_salary_payments (
  id                   SERIAL PRIMARY KEY,
  factory_id           INT NOT NULL REFERENCES factories(id),
  employee_id          INT NOT NULL REFERENCES employees(id),
  salary_month         DATE NOT NULL,
  amount               NUMERIC(10,2) NOT NULL,
  payment_method       VARCHAR(10) NOT NULL CHECK (payment_method IN ('CASH','BANK')),
  bank_id              INT REFERENCES bank_accounts(id),
  notes                TEXT,
  khata_entry_id       INT REFERENCES employee_khata_entries(id),
  debit_khata_entry_id INT REFERENCES employee_khata_entries(id),
  transaction_id       INT REFERENCES transactions(id),
  created_by           INT NOT NULL REFERENCES users(id),
  season_id            INT REFERENCES seasons(id),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 28. gate_passes
CREATE TABLE IF NOT EXISTS gate_passes (
  id             SERIAL PRIMARY KEY,
  factory_id     INT NOT NULL REFERENCES factories(id),
  gp_number      VARCHAR(50) NOT NULL UNIQUE,
  pass_type      VARCHAR(5) NOT NULL CHECK (pass_type IN ('IN','OUT')),
  vehicle_number VARCHAR(100),
  driver_name    VARCHAR(255),
  driver_phone   VARCHAR(50),
  party_type     VARCHAR(10) NOT NULL CHECK (party_type IN ('CUSTOMER','SUPPLIER','OTHER')),
  party_name     VARCHAR(255) NOT NULL,
  description    TEXT,
  pass_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     INT NOT NULL REFERENCES users(id),
  season_id      INT REFERENCES seasons(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- Bag weights (standard sizes)
INSERT INTO bag_weights (weight_value, unit) VALUES
  (8,  'kg'),
  (10, 'kg'),
  (20, 'kg'),
  (40, 'kg'),
  (50, 'kg')
ON CONFLICT (weight_value, unit) DO NOTHING;

-- Factory
INSERT INTO factories (id, name, address, phone)
VALUES (1, 'Main Factory', 'Factory Address', '0300-0000000')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence if factory was just inserted
SELECT setval('factories_id_seq', GREATEST((SELECT MAX(id) FROM factories), 1));

-- Settings
INSERT INTO settings (factory_id, company_name, invoice_footer)
VALUES (1, 'Main Factory', 'Thank you for your business!')
ON CONFLICT (factory_id) DO NOTHING;

-- Cash account
INSERT INTO cash_accounts (factory_id, balance)
VALUES (1, 0)
ON CONFLICT (factory_id) DO NOTHING;

-- Document sequences (all 5 types)
INSERT INTO document_sequences (factory_id, document_type, last_sequence) VALUES
  (1, 'SI', 0),
  (1, 'PI', 0),
  (1, 'PV', 0),
  (1, 'JV', 0),
  (1, 'GP', 0)
ON CONFLICT (factory_id, document_type) DO NOTHING;

-- Season 1 (active)
INSERT INTO seasons (factory_id, name, start_date, is_active)
VALUES (1, 'Season 1', CURRENT_DATE, TRUE)
ON CONFLICT DO NOTHING;

-- Admin user  (password: admin123)
INSERT INTO users (factory_id, username, password_hash, role)
VALUES (1, 'admin', '$2b$10$bsSB6TmRAJ0HftfW5t9r9.c2bf2RmjH.kBrYw5GCNHWvIloA6M2P6', 'ADMIN')
ON CONFLICT (username) DO NOTHING;

-- Accountant user  (password: acc123)
INSERT INTO users (factory_id, username, password_hash, role)
VALUES (1, 'accountant', '$2b$10$.WYpIml4dbwNkvXf89jmoOTcZIi5lCmjYn/uPEIu8nD39.yZuXBUK', 'ACCOUNTANT')
ON CONFLICT (username) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Default credentials:
--   admin       → password: admin123
--   accountant  → password: acc123
-- Change passwords via the app Settings page after first login.
-- ─────────────────────────────────────────────────────────────────────────────
