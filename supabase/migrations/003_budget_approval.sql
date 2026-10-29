-- Secure, single-use links for customer budget approval.
-- Run after 001_initial_schema.sql and 002_private_order_photo_storage.sql.

CREATE TABLE IF NOT EXISTS public.service_order_approval_tokens (
  order_id UUID PRIMARY KEY REFERENCES public.service_orders(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

ALTER TABLE public.service_order_approval_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage budget approval tokens"
  ON public.service_order_approval_tokens;
CREATE POLICY "Authenticated manage budget approval tokens"
  ON public.service_order_approval_tokens
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.service_order_approval_tokens FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.service_order_approval_tokens TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_service_order_budget(p_token_hash TEXT)
RETURNS pg_catalog.JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id UUID;
  v_os_number TEXT;
  v_previous_status TEXT;
  v_now TIMESTAMPTZ := pg_catalog.NOW();
BEGIN
  SELECT token.order_id, service_orders.os_number, service_orders.status
    INTO v_order_id, v_os_number, v_previous_status
  FROM public.service_order_approval_tokens AS token
  JOIN public.service_orders
    ON service_orders.id = token.order_id
  WHERE token.token_hash = p_token_hash
    AND token.consumed_at IS NULL
    AND token.expires_at > v_now
    AND service_orders.is_published = true
    AND service_orders.is_cancelled = false
    AND service_orders.budget_status = 'aguardando_aprovacao'
  FOR UPDATE OF token, service_orders;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('approved', false);
  END IF;

  UPDATE public.service_orders
  SET budget_status = 'aprovado',
      status = 'aguardando_pecas',
      budget_approval_date = v_now,
      updated_at = v_now
  WHERE id = v_order_id;

  UPDATE public.service_order_approval_tokens
  SET consumed_at = v_now
  WHERE order_id = v_order_id;

  INSERT INTO public.service_order_history (
    service_order_id,
    actor_name,
    event_type,
    previous_value,
    new_value,
    public_message,
    created_at
  ) VALUES (
    v_order_id,
    'Cliente',
    'status_change',
    v_previous_status,
    'aguardando_pecas',
    'Orçamento aprovado pelo cliente. Aguardando peças.',
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'approved', true,
    'order_number', v_os_number,
    'status', 'aguardando_pecas',
    'budget_status', 'aprovado'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_service_order_budget(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_service_order_budget(TEXT)
  TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'service_orders'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_orders;
  END IF;
END;
$$;
