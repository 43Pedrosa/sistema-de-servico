-- Add the username association used by the server-side administrative login.
-- Existing profiles must be assigned a username before those accounts can log in.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_username_format
    CHECK (username IS NULL OR username ~ '^[a-z0-9._-]{3,32}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;
