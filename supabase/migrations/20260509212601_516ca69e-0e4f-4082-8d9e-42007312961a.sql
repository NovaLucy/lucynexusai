
-- Add user_id to all sensitive tables and lock down RLS to authenticated owners

ALTER TABLE public.apn_memory ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.apn_health_records ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.apn_user_profile ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_apn_memory_user_id ON public.apn_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_apn_health_records_user_id ON public.apn_health_records(user_id);
CREATE INDEX IF NOT EXISTS idx_apn_user_profile_user_id ON public.apn_user_profile(user_id);

-- Drop old permissive policies
DROP POLICY IF EXISTS "anyone can read apn_memory" ON public.apn_memory;
DROP POLICY IF EXISTS "anyone can insert apn_memory" ON public.apn_memory;
DROP POLICY IF EXISTS "anyone can read apn_health_records" ON public.apn_health_records;
DROP POLICY IF EXISTS "anyone can insert apn_health_records" ON public.apn_health_records;
DROP POLICY IF EXISTS "anyone can read apn_user_profile" ON public.apn_user_profile;
DROP POLICY IF EXISTS "anyone can insert apn_user_profile" ON public.apn_user_profile;
DROP POLICY IF EXISTS "anyone can update apn_user_profile" ON public.apn_user_profile;

-- Owner-scoped policies (apn_memory)
CREATE POLICY "users read own memory" ON public.apn_memory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own memory" ON public.apn_memory
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Owner-scoped policies (apn_health_records)
CREATE POLICY "users read own health" ON public.apn_health_records
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own health" ON public.apn_health_records
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Owner-scoped policies (apn_user_profile)
CREATE POLICY "users read own profile" ON public.apn_user_profile
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own profile" ON public.apn_user_profile
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own profile" ON public.apn_user_profile
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Purge legacy rows that have no owner (publicly inserted test data)
DELETE FROM public.apn_memory WHERE user_id IS NULL;
DELETE FROM public.apn_health_records WHERE user_id IS NULL;
DELETE FROM public.apn_user_profile WHERE user_id IS NULL;
