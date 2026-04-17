-- Migration 011: Season / Financial Year Rollover
-- Run against: psql -U postgres -p 5400 -d factory_erp

-- ─────────────────────────────────────────
-- 1. seasons
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasons (
  id          SERIAL PRIMARY KEY,
  factory_id  INT NOT NULL REFERENCES factories(id),
  name        VARCHAR(100) NOT NULL,        -- e.g. "Season 2024-25"
  start_date  DATE NOT NULL,
  end_date    DATE,
  is_active   BOOLEAN DEFAULT TRUE,
  closed_at   TIMESTAMPTZ,
  closed_by   INT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active season per factory
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_season
  ON seasons (factory_id) WHERE is_active = TRUE;

-- ─────────────────────────────────────────
-- 2. season_opening_balances
-- Snapshot of closing balances carried into a new season
-- entity_type: CUSTOMER | SUPPLIER | EMPLOYEE | BANK | CASH
-- balance > 0  = they owe us (receivable)
-- balance < 0  = we owe them (payable)
-- ─────────────────────────────────────────
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

-- ─────────────────────────────────────────
-- 3. Add season_id to all transactional tables
--    NULL = legacy data (before seasons feature)
-- ─────────────────────────────────────────
ALTER TABLE sales               ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);
ALTER TABLE purchases           ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);
ALTER TABLE payments            ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);
ALTER TABLE transactions        ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);
ALTER TABLE stock_transactions  ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);
ALTER TABLE expenses            ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);
ALTER TABLE employee_khata_entries    ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);
ALTER TABLE employee_salary_payments  ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);
ALTER TABLE gate_passes         ADD COLUMN IF NOT EXISTS season_id INT REFERENCES seasons(id);

-- ─────────────────────────────────────────
-- 4. Seed: create Season 1 for every existing factory
--    and backfill all existing records into it
-- ─────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  s_id INT;
BEGIN
  FOR r IN SELECT id FROM factories LOOP
    -- Insert season 1 if not already present
    INSERT INTO seasons (factory_id, name, start_date, is_active)
    VALUES (r.id, 'Season 1', CURRENT_DATE, TRUE)
    ON CONFLICT DO NOTHING
    RETURNING id INTO s_id;

    -- If already existed, fetch its id
    IF s_id IS NULL THEN
      SELECT id INTO s_id FROM seasons WHERE factory_id = r.id AND is_active = TRUE LIMIT 1;
    END IF;

    -- Backfill existing records
    UPDATE sales              SET season_id = s_id WHERE factory_id = r.id AND season_id IS NULL;
    UPDATE purchases          SET season_id = s_id WHERE factory_id = r.id AND season_id IS NULL;
    UPDATE payments           SET season_id = s_id WHERE factory_id = r.id AND season_id IS NULL;
    UPDATE transactions       SET season_id = s_id WHERE factory_id = r.id AND season_id IS NULL;
    UPDATE stock_transactions SET season_id = s_id WHERE factory_id = r.id AND season_id IS NULL;
    UPDATE expenses           SET season_id = s_id WHERE factory_id = r.id AND season_id IS NULL;
    UPDATE employee_khata_entries   SET season_id = s_id WHERE factory_id = r.id AND season_id IS NULL;
    UPDATE employee_salary_payments SET season_id = s_id WHERE factory_id = r.id AND season_id IS NULL;
    UPDATE gate_passes        SET season_id = s_id WHERE factory_id = r.id AND season_id IS NULL;
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- 5. Add debit_khata_entry_id to employee_salary_payments if missing
-- ─────────────────────────────────────────
ALTER TABLE employee_salary_payments
  ADD COLUMN IF NOT EXISTS debit_khata_entry_id INT REFERENCES employee_khata_entries(id);
