-- Absence dates for payroll records (multi-select dates when entering absence deductions)
-- Run in Supabase SQL editor for both orgs.

ALTER TABLE IF EXISTS payroll_records
  ADD COLUMN IF NOT EXISTS absence_dates text[] DEFAULT '{}';

ALTER TABLE IF EXISTS pdn_payroll_records
  ADD COLUMN IF NOT EXISTS absence_dates text[] DEFAULT '{}';

COMMENT ON COLUMN payroll_records.absence_dates IS 'ISO dates (yyyy-MM-dd) the employee was absent for this pay period';
COMMENT ON COLUMN pdn_payroll_records.absence_dates IS 'ISO dates (yyyy-MM-dd) the employee was absent for this pay period';
