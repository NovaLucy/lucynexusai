
-- apn_persona table
CREATE TABLE public.apn_persona (
  user_id uuid PRIMARY KEY,
  traits jsonb NOT NULL DEFAULT '{"humor":0.5,"directness":0.5,"warmth":0.6,"curiosity":0.6,"playfulness":0.4,"protectiveness":0.5}'::jsonb,
  quirks text[] NOT NULL DEFAULT ARRAY[]::text[],
  bond_level integer NOT NULL DEFAULT 0,
  inside_jokes jsonb NOT NULL DEFAULT '[]'::jsonb,
  stance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apn_persona ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own persona"
  ON public.apn_persona FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own persona"
  ON public.apn_persona FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own persona"
  ON public.apn_persona FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Vision bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('apn-vision', 'apn-vision', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "users read own vision"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'apn-vision' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users upload own vision"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'apn-vision' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users delete own vision"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'apn-vision' AND auth.uid()::text = (storage.foldername(name))[1]);
