-- Migration: Gate Pass System
-- Run against: psql -U postgres -p 5400 -d factory_erp

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
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Add GP to document_sequences check constraint
ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS document_sequences_document_type_check;
ALTER TABLE document_sequences ADD CONSTRAINT document_sequences_document_type_check
  CHECK (document_type IN ('SI','PI','PV','JV','GP'));
