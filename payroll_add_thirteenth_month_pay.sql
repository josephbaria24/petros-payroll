-- Run in Supabase SQL editor: 13th month pay on payroll (earnings).
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS thirteenth_month_pay numeric DEFAULT 0;

ALTER TABLE public.pdn_payroll_records
  ADD COLUMN IF NOT EXISTS thirteenth_month_pay numeric DEFAULT 0;
