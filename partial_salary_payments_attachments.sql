-- Run in Supabase SQL editor: attachments + updated_at for partial salary payments.
-- attachments: jsonb array of { name, url, uploaded_at }

ALTER TABLE public.partial_salary_payments
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();

ALTER TABLE public.pdn_partial_salary_payments
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();

-- Backfill updated_at for existing rows
UPDATE public.partial_salary_payments
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

UPDATE public.pdn_partial_salary_payments
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;
