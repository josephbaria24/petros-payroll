-- Custom payroll workspaces (e.g. "13th Month Pay", "Bonus Run").
-- NULL workspace_id on payroll records = Regular Payroll (default tab).

CREATE TABLE IF NOT EXISTS public.payroll_workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization text NOT NULL DEFAULT 'petrosphere'
    CHECK (organization = ANY (ARRAY['petrosphere'::text, 'pdn'::text])),
  creator_id uuid REFERENCES public.profiles(id),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT payroll_workspaces_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS payroll_workspaces_org_idx
  ON public.payroll_workspaces (organization);

ALTER TABLE public.payroll_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.payroll_workspaces;
CREATE POLICY "Allow all for authenticated users" ON public.payroll_workspaces
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Link regular & PDN payroll records to a workspace (nullable = Regular Payroll)
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.payroll_workspaces(id) ON DELETE SET NULL;

ALTER TABLE public.pdn_payroll_records
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.payroll_workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payroll_records_workspace_id_idx
  ON public.payroll_records (workspace_id);

CREATE INDEX IF NOT EXISTS pdn_payroll_records_workspace_id_idx
  ON public.pdn_payroll_records (workspace_id);
