-- 1. Add column to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 2. Add column to pdn_employees
ALTER TABLE public.pdn_employees ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 3. Add column to profiles (for the Azure SSO avatars)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
