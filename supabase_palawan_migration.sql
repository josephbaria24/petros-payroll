-- ============================================
-- PDN (Palawan Daily News) Tables Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. PDN EMPLOYEES
CREATE TABLE public.pdn_employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_code text,
  full_name text,
  position text,
  department text,
  employment_status text CHECK (employment_status = ANY (ARRAY['Regular'::text, 'Probationary'::text, 'Project-based'::text, 'Contractual'::text, 'Inactive'::text])),
  tin text,
  sss text,
  philhealth text,
  pagibig text,
  base_salary numeric,
  pay_type text DEFAULT 'monthly'::text CHECK (pay_type = ANY (ARRAY['monthly'::text, 'semi-monthly'::text, 'daily'::text, 'hourly'::text])),
  shift text,
  hours_per_week integer,
  leave_credits numeric DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  email text,
  allowance numeric DEFAULT 0,
  CONSTRAINT pdn_employees_pkey PRIMARY KEY (id)
);

ALTER TABLE public.pdn_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.pdn_employees
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 2. PDN PAYROLL RECORDS
CREATE TABLE public.pdn_payroll_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  basic_salary numeric,
  overtime_pay numeric DEFAULT 0,
  holiday_pay numeric DEFAULT 0,
  night_diff numeric DEFAULT 0,
  sss numeric DEFAULT 0,
  philhealth numeric DEFAULT 0,
  pagibig numeric DEFAULT 0,
  withholding_tax numeric DEFAULT 0,
  loans numeric DEFAULT 0,
  uniform numeric DEFAULT 0,
  tardiness numeric DEFAULT 0,
  absences numeric DEFAULT 0,
  allowances numeric DEFAULT 0,
  bonuses numeric DEFAULT 0,
  commission numeric DEFAULT 0,
  gross_pay numeric,
  total_deductions numeric,
  net_pay numeric,
  created_at timestamp without time zone DEFAULT now(),
  status text,
  cash_advance numeric DEFAULT 0,
  updated_at timestamp without time zone DEFAULT now(),
  creator_id uuid,
  CONSTRAINT pdn_payroll_records_pkey PRIMARY KEY (id),
  CONSTRAINT pdn_payroll_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.pdn_employees(id) ON DELETE CASCADE
);

ALTER TABLE public.pdn_payroll_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.pdn_payroll_records
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 3. PDN ATTENDANCE LOGS
CREATE TABLE public.pdn_attendance_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  employee_id uuid,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  status text,
  created_at timestamp with time zone DEFAULT now(),
  timeout timestamp with time zone,
  total_hours numeric DEFAULT 0,
  overtime_hours numeric DEFAULT 0,
  work_date date,
  full_name text,
  CONSTRAINT pdn_attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT pdn_attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.pdn_employees(id) ON DELETE CASCADE
);

ALTER TABLE public.pdn_attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.pdn_attendance_logs
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. PDN DEDUCTIONS (for payroll generation)
CREATE TABLE public.pdn_deductions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pdn_deductions_pkey PRIMARY KEY (id),
  CONSTRAINT pdn_deductions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.pdn_employees(id) ON DELETE CASCADE
);

ALTER TABLE public.pdn_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.pdn_deductions
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 5. FIX: Add DELETE policy on existing employees table if missing
-- (This fixes the "delete not working" issue for Petrosphere employees)
-- Uncomment and run if you don't have a DELETE policy:
-- CREATE POLICY "Allow delete for authenticated users" ON public.employees
--   FOR DELETE USING (auth.role() = 'authenticated');
