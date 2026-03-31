-- Migration 010: Fix CHECK constraints on existing databases
-- Run this on any live server that was set up before these constraints were updated.
-- Safe to run multiple times (uses IF EXISTS / DO NOTHING patterns).

-- ─────────────────────────────────────────
-- Fix 1: transactions.source_type
-- Add EMPLOYEE, EXPENSE, SALARY to the allowed values
-- ─────────────────────────────────────────
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_source_type_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_source_type_check
  CHECK (source_type IN ('CUSTOMER', 'SUPPLIER', 'SYSTEM', 'EMPLOYEE', 'EXPENSE', 'SALARY'));

-- ─────────────────────────────────────────
-- Fix 2: document_sequences.document_type
-- Add GP (Gate Pass) to the allowed values
-- ─────────────────────────────────────────
ALTER TABLE document_sequences DROP CONSTRAINT IF EXISTS document_sequences_document_type_check;

ALTER TABLE document_sequences
  ADD CONSTRAINT document_sequences_document_type_check
  CHECK (document_type IN ('SI', 'PI', 'PV', 'JV', 'GP'));
