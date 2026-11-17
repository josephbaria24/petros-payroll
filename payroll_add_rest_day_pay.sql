-- Rest day pay for payroll records
-- Run in Supabase SQL editor for both orgs.

ALTER TABLE IF EXISTS payroll_records
  ADD COLUMN IF NOT EXISTS rest_day_pay numeric DEFAULT 0;

ALTER TABLE IF EXISTS pdn_payroll_records
  ADD COLUMN IF NOT EXISTS rest_day_pay numeric DEFAULT 0;

COMMENT ON COLUMN payroll_records.rest_day_pay IS 'Pay for work performed on a rest day';
COMMENT ON COLUMN pdn_payroll_records.rest_day_pay IS 'Pay for work performed on a rest day';
