-- Run in Supabase SQL editor: itemized partial salary payments (cash advances)
-- linked to an employee and a payroll period. The sum per period is synced to
-- payroll_records.cash_advance / pdn_payroll_records.cash_advance by the app.

CREATE TABLE IF NOT EXISTS public.partial_salary_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT now(),
  notes text,
  creator_id uuid REFERENCES public.profiles(id),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT partial_salary_payments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS partial_salary_payments_emp_period_idx
  ON public.partial_salary_payments (employee_id, period_start, period_end);

ALTER TABLE public.partial_salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.partial_salary_payments;
CREATE POLICY "Allow all for authenticated users" ON public.partial_salary_payments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- PDN (Palawan Daily News)
CREATE TABLE IF NOT EXISTS public.pdn_partial_salary_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.pdn_employees(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT now(),
  notes text,
  creator_id uuid REFERENCES public.profiles(id),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT pdn_partial_salary_payments_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS pdn_partial_salary_payments_emp_period_idx
  ON public.pdn_partial_salary_payments (employee_id, period_start, period_end);

ALTER TABLE public.pdn_partial_salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.pdn_partial_salary_payments;
CREATE POLICY "Allow all for authenticated users" ON public.pdn_partial_salary_payments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
