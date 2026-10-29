-- Allow server-configured administrator sessions without a profiles/Auth user row.
ALTER TABLE public.admin_sessions
  ALTER COLUMN profile_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS principal_username TEXT,
  ADD COLUMN IF NOT EXISTS principal_name TEXT,
  ADD COLUMN IF NOT EXISTS principal_role TEXT,
  ADD COLUMN IF NOT EXISTS principal_credential_version TEXT;

DO $$
BEGIN
  ALTER TABLE public.admin_sessions
    ADD CONSTRAINT admin_sessions_principal_check
    CHECK (
      (profile_id IS NOT NULL AND principal_role IS NULL)
      OR (
        profile_id IS NULL
        AND principal_username IS NOT NULL
        AND principal_name IS NOT NULL
        AND principal_role = 'admin'
        AND principal_credential_version IS NOT NULL
        AND principal_credential_version ~ '^[a-f0-9]{64}$'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
