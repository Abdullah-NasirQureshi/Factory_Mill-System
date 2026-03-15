USE factory_erp;

-- ─────────────────────────────────────────
-- 1. factories
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factories (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  address    TEXT,
  phone      VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 2. users
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  factory_id    INT NOT NULL,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('ADMIN','ACCOUNTANT') NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id) REFERENCES factories(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 3. customers
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  factory_id INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(20),
  address    TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP NULL,
  deleted_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 4. suppliers
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  factory_id INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(20),
  address    TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP NULL,
  deleted_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 5. products
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  factory_id INT NOT NULL,
  name       VARCHAR(255) NOT NULL,
  status     ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id) REFERENCES factories(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 6. bag_weights
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bag_weights (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  weight_value DECIMAL(10,2) NOT NULL,
  unit         VARCHAR(10) DEFAULT 'kg',
  UNIQUE KEY uq_weight (weight_value, unit)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 7. inventory
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  factory_id INT NOT NULL,
  product_id INT NOT NULL,
  weight_id  INT NOT NULL,
  quantity   DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_inventory (factory_id, product_id, weight_id),
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (weight_id)  REFERENCES bag_weights(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 8. document_sequences  (SI, PI, PV, JV)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_sequences (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  factory_id    INT NOT NULL,
  document_type ENUM('SI','PI','PV','JV') NOT NULL,
  last_sequence INT DEFAULT 0,
  UNIQUE KEY uq_seq (factory_id, document_type),
  FOREIGN KEY (factory_id) REFERENCES factories(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 9. bank_accounts
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  factory_id     INT NOT NULL,
  bank_name      VARCHAR(255) NOT NULL,
  account_title  VARCHAR(255) NOT NULL,
  account_number VARCHAR(50)  NOT NULL,
  balance        DECIMAL(10,2) DEFAULT 0,
  is_deleted     BOOLEAN DEFAULT FALSE,
  deleted_at     TIMESTAMP NULL,
  deleted_by     INT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 10. cash_accounts
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_accounts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  factory_id INT NOT NULL UNIQUE,
  balance    DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id) REFERENCES factories(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 11. sales
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  factory_id       INT NOT NULL,
  customer_id      INT NOT NULL,
  invoice_number   VARCHAR(50) NOT NULL UNIQUE,
  total_amount     DECIMAL(10,2) NOT NULL,
  paid_amount      DECIMAL(10,2) DEFAULT 0,
  remaining_amount DECIMAL(10,2) NOT NULL,
  created_by       INT NOT NULL,
  status           ENUM('ACTIVE','REVERTED') DEFAULT 'ACTIVE',
  is_deleted       BOOLEAN DEFAULT FALSE,
  deleted_at       TIMESTAMP NULL,
  deleted_by       INT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id)  REFERENCES factories(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by)  REFERENCES users(id),
  FOREIGN KEY (deleted_by)  REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 12. sale_items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  sale_id    INT NOT NULL,
  product_id INT NOT NULL,
  weight_id  INT NOT NULL,
  quantity   DECIMAL(10,2) NOT NULL,
  price      DECIMAL(10,2) NOT NULL,
  total      DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (sale_id)    REFERENCES sales(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (weight_id)  REFERENCES bag_weights(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 13. purchases
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  factory_id       INT NOT NULL,
  supplier_id      INT NOT NULL,
  invoice_number   VARCHAR(50) NOT NULL UNIQUE,
  total_amount     DECIMAL(10,2) NOT NULL,
  paid_amount      DECIMAL(10,2) DEFAULT 0,
  remaining_amount DECIMAL(10,2) NOT NULL,
  purchase_date    DATE NOT NULL,
  created_by       INT NOT NULL,
  status           ENUM('ACTIVE','REVERTED') DEFAULT 'ACTIVE',
  is_deleted       BOOLEAN DEFAULT FALSE,
  deleted_at       TIMESTAMP NULL,
  deleted_by       INT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id)  REFERENCES factories(id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by)  REFERENCES users(id),
  FOREIGN KEY (deleted_by)  REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 14. purchase_items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id  INT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity     DECIMAL(10,2) NOT NULL,
  unit_price   DECIMAL(10,2) NOT NULL,
  total        DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 15. payments
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  factory_id     INT NOT NULL,
  voucher_number VARCHAR(50) NOT NULL UNIQUE,
  type           ENUM('CUSTOMER_PAYMENT','SUPPLIER_PAYMENT') NOT NULL,
  reference_id   INT NOT NULL,
  payment_method ENUM('CASH','BANK') NOT NULL,
  bank_id        INT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  notes          TEXT,
  created_by     INT NOT NULL,
  status         ENUM('ACTIVE','REVERTED') DEFAULT 'ACTIVE',
  is_deleted     BOOLEAN DEFAULT FALSE,
  deleted_at     TIMESTAMP NULL,
  deleted_by     INT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (bank_id)    REFERENCES bank_accounts(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 16. payment_allocations
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_allocations (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  payment_id       INT NOT NULL,
  reference_type   ENUM('SALE','PURCHASE') NOT NULL,
  reference_id     INT NOT NULL,
  allocated_amount DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 17. transactions  (central ledger)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  factory_id       INT NOT NULL,
  voucher_number   VARCHAR(50) UNIQUE NULL,
  transaction_type ENUM('IN','OUT','ADJUST','REVERSAL') NOT NULL,
  source_type      ENUM('CUSTOMER','SUPPLIER','SYSTEM') NOT NULL,
  source_id        INT NULL,
  payment_method   ENUM('CASH','BANK','NONE') NOT NULL,
  bank_id          INT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  reference_id     INT NULL,
  notes            TEXT,
  is_deleted       BOOLEAN DEFAULT FALSE,
  deleted_at       TIMESTAMP NULL,
  deleted_by       INT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (bank_id)    REFERENCES bank_accounts(id),
  FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 18. stock_transactions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transactions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  factory_id INT NOT NULL,
  product_id INT NOT NULL,
  weight_id  INT NOT NULL,
  type       ENUM('ADD','SALE','ADJUST') NOT NULL,
  quantity   DECIMAL(10,2) NOT NULL,
  reference_id INT NULL,
  note       TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factory_id) REFERENCES factories(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (weight_id)  REFERENCES bag_weights(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- 19. settings
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  factory_id     INT NOT NULL UNIQUE,
  company_name   VARCHAR(255),
  company_logo   VARCHAR(500),
  address        TEXT,
  phone          VARCHAR(20),
  invoice_footer TEXT,
  FOREIGN KEY (factory_id) REFERENCES factories(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────
-- SEED: bag weights
-- ─────────────────────────────────────────
INSERT IGNORE INTO bag_weights (weight_value, unit) VALUES
  (8,  'kg'),
  (10, 'kg'),
  (20, 'kg'),
  (40, 'kg'),
  (50, 'kg');
