-- Persist login attempt limits across local and serverless API instances.
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  bucket_hash TEXT PRIMARY KEY CHECK (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0)
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_window
  ON public.admin_login_attempts (window_started_at);

ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_login_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.consume_admin_login_attempt(p_bucket_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_allowed BOOLEAN;
  v_now TIMESTAMPTZ := pg_catalog.NOW();
BEGIN
  IF p_bucket_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.admin_login_attempts AS stored_attempts (bucket_hash, window_started_at, attempts)
  VALUES (p_bucket_hash, v_now, 1)
  ON CONFLICT (bucket_hash) DO UPDATE
  SET window_started_at = CASE
        WHEN stored_attempts.window_started_at <= v_now - INTERVAL '15 minutes'
        THEN v_now
        ELSE stored_attempts.window_started_at
      END,
      attempts = CASE
        WHEN stored_attempts.window_started_at <= v_now - INTERVAL '15 minutes'
        THEN 1
        ELSE stored_attempts.attempts + 1
      END
  RETURNING stored_attempts.attempts <= 5 INTO v_allowed;

  DELETE FROM public.admin_login_attempts
  WHERE window_started_at < v_now - INTERVAL '1 day';

  RETURN v_allowed;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_admin_login_attempt(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_admin_login_attempt(TEXT)
  TO service_role;
