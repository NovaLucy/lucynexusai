CREATE TABLE public.apn_user_profile (
  session_id text PRIMARY KEY,
  display_name text,
  traits jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_topic text,
  open_loops jsonb NOT NULL DEFAULT '[]'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apn_user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read apn_user_profile"
  ON public.apn_user_profile FOR SELECT
  USING (true);

CREATE POLICY "anyone can insert apn_user_profile"
  ON public.apn_user_profile FOR INSERT
  WITH CHECK (true);

CREATE POLICY "anyone can update apn_user_profile"
  ON public.apn_user_profile FOR UPDATE
  USING (true);

CREATE INDEX idx_apn_user_profile_last_seen ON public.apn_user_profile(last_seen DESC);