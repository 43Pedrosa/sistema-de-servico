-- Store scrypt password hashes and server-validated HttpOnly session tokens.
-- The application uses service-role access only in server-side API handlers.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_profile_expiry
  ON public.admin_sessions (profile_id, expires_at);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_sessions TO service_role;

REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO service_role;
