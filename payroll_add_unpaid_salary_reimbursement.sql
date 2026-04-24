-- Run in Supabase SQL editor: unpaid salary & reimbursement on payroll (earnings).
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS unpaid_salary numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reimbursement numeric DEFAULT 0;

ALTER TABLE public.pdn_payroll_records
  ADD COLUMN IF NOT EXISTS unpaid_salary numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reimbursement numeric DEFAULT 0;
