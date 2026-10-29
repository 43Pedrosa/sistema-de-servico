-- Replace one-time approval links with direct confirmation from the public OS page.
-- Run after 003_budget_approval.sql.

DROP FUNCTION IF EXISTS public.approve_service_order_budget(TEXT);
DROP TABLE IF EXISTS public.service_order_approval_tokens;

CREATE FUNCTION public.approve_service_order_budget(p_os_number TEXT)
RETURNS pg_catalog.JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_previous_status TEXT;
  v_now TIMESTAMPTZ := pg_catalog.NOW();
BEGIN
  SELECT service_orders.id, service_orders.os_number, service_orders.status
    INTO v_order_id, v_order_number, v_previous_status
  FROM public.service_orders
  WHERE pg_catalog.lower(service_orders.os_number) = pg_catalog.lower(pg_catalog.btrim(p_os_number))
    AND service_orders.is_published = true
    AND service_orders.is_cancelled = false
    AND service_orders.budget_status = 'aguardando_aprovacao'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('approved', false);
  END IF;

  UPDATE public.service_orders
  SET budget_status = 'aprovado',
      status = 'aguardando_pecas',
      budget_approval_date = v_now,
      budget_approval_notes = 'Aprovado pelo cliente na página pública da OS.',
      updated_at = v_now
  WHERE id = v_order_id;

  INSERT INTO public.service_order_history (
    id,
    service_order_id,
    actor_name,
    event_type,
    previous_value,
    new_value,
    public_message,
    created_at
  ) VALUES (
    pg_catalog.gen_random_uuid(),
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
    'order_number', v_order_number,
    'status', 'aguardando_pecas',
    'budget_status', 'aprovado'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_service_order_budget(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_service_order_budget(TEXT)
  TO service_role;
