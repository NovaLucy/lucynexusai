
CREATE TABLE public.apn_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('fact','preference','event','relation','emotion','commitment','insight')),
  subject TEXT,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  importance SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  source_session_id TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.apn_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own memories"   ON public.apn_memories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own memories" ON public.apn_memories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own memories" ON public.apn_memories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own memories" ON public.apn_memories FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_apn_memories_user ON public.apn_memories(user_id, importance DESC, created_at DESC);
CREATE INDEX idx_apn_memories_tags ON public.apn_memories USING GIN(tags);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_apn_memories_updated
BEFORE UPDATE ON public.apn_memories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
