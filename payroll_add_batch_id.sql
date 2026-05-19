-- Payroll versioning uses existing public.payroll_runs + run_id on payroll_records.
-- Petrosphere already has run_id on payroll_records.
-- PDN: add run_id so new versions work the same way.

ALTER TABLE public.pdn_payroll_records
  ADD COLUMN IF NOT EXISTS run_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pdn_payroll_records_run_id_fkey'
  ) THEN
    ALTER TABLE public.pdn_payroll_records
      ADD CONSTRAINT pdn_payroll_records_run_id_fkey
      FOREIGN KEY (run_id) REFERENCES public.payroll_runs(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pdn_payroll_records_run_id_idx
  ON public.pdn_payroll_records (run_id);

CREATE INDEX IF NOT EXISTS payroll_records_period_run_idx
  ON public.payroll_records (period_start, period_end, run_id);
