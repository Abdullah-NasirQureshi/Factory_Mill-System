-- PostgreSQL schema for factory_erp
-- Run against: psql -U postgres -p 5400 -d factory_erp

-- ─────────────────────────────────────────
-- 1. factories
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  address    TEXT,
  phone      VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 2. users
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  factory_id    INT NOT NULL REFERENCES factories(id),
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN','ACCOUNTANT')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. customers
-- ─────────────────────────────────────────
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

-- ─────────────────────────────────────────
-- 4. suppliers
-- ─────────────────────────────────────────
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

-- ─────────────────────────────────────────
-- 5. products
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  name       VARCHAR(255) NOT NULL,
  status     VARCHAR(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 6. bag_weights
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bag_weights (
  id           SERIAL PRIMARY KEY,
  weight_value NUMERIC(10,2) NOT NULL,
  unit         VARCHAR(10) DEFAULT 'kg',
  UNIQUE (weight_value, unit)
);

-- ─────────────────────────────────────────
-- 7. inventory
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  product_id INT NOT NULL REFERENCES products(id),
  weight_id  INT NOT NULL REFERENCES bag_weights(id),
  quantity   NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (factory_id, product_id, weight_id)
);

-- ─────────────────────────────────────────
-- 8. document_sequences
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_sequences (
  id            SERIAL PRIMARY KEY,
  factory_id    INT NOT NULL REFERENCES factories(id),
  document_type VARCHAR(5) NOT NULL CHECK (document_type IN ('SI','PI','PV','JV','GP')),
  last_sequence INT DEFAULT 0,
  UNIQUE (factory_id, document_type)
);

-- ─────────────────────────────────────────
-- 9. bank_accounts
-- ─────────────────────────────────────────
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

-- ─────────────────────────────────────────
-- 10. cash_accounts
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_accounts (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL UNIQUE REFERENCES factories(id),
  balance    NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 11. sales
-- ─────────────────────────────────────────
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
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 12. sale_items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id         SERIAL PRIMARY KEY,
  sale_id    INT NOT NULL REFERENCES sales(id),
  product_id INT NOT NULL REFERENCES products(id),
  weight_id  INT NOT NULL REFERENCES bag_weights(id),
  quantity   NUMERIC(10,2) NOT NULL,
  price      NUMERIC(10,2) NOT NULL,
  total      NUMERIC(10,2) NOT NULL
);

-- ─────────────────────────────────────────
-- 13. purchases
-- ─────────────────────────────────────────
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
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 14. purchase_items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
  id           SERIAL PRIMARY KEY,
  purchase_id  INT NOT NULL REFERENCES purchases(id),
  product_name VARCHAR(255) NOT NULL,
  quantity     NUMERIC(10,2) NOT NULL,
  unit_price   NUMERIC(10,2) NOT NULL,
  total        NUMERIC(10,2) NOT NULL
);

-- ─────────────────────────────────────────
-- 15. payments
-- ─────────────────────────────────────────
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
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 16. payment_allocations
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_allocations (
  id               SERIAL PRIMARY KEY,
  payment_id       INT NOT NULL REFERENCES payments(id),
  reference_type   VARCHAR(10) NOT NULL CHECK (reference_type IN ('SALE','PURCHASE')),
  reference_id     INT NOT NULL,
  allocated_amount NUMERIC(10,2) NOT NULL
);

-- ─────────────────────────────────────────
-- 17. transactions
-- ─────────────────────────────────────────
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
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 18. stock_transactions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transactions (
  id         SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id),
  product_id INT NOT NULL REFERENCES products(id),
  weight_id  INT NOT NULL REFERENCES bag_weights(id),
  type       VARCHAR(10) NOT NULL CHECK (type IN ('ADD','SALE','ADJUST')),
  quantity   NUMERIC(10,2) NOT NULL,
  reference_id INT,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 19. settings
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id             SERIAL PRIMARY KEY,
  factory_id     INT NOT NULL UNIQUE REFERENCES factories(id),
  company_name   VARCHAR(255),
  company_logo   VARCHAR(500),
  address        TEXT,
  phone          VARCHAR(20),
  invoice_footer TEXT
);

-- ─────────────────────────────────────────
-- SEED: bag weights
-- ─────────────────────────────────────────
INSERT INTO bag_weights (weight_value, unit) VALUES
  (8,  'kg'),
  (10, 'kg'),
  (20, 'kg'),
  (40, 'kg'),
  (50, 'kg')
ON CONFLICT (weight_value, unit) DO NOTHING;
