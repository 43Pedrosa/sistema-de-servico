-- Make customer budget approval a persisted service-order status and remove the obsolete waiting status.
ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_status_check;

UPDATE public.service_orders
SET status = CASE
  WHEN budget_status = 'aprovado' THEN 'orcamento_aprovado'
  ELSE 'orcamento_enviado'
END,
updated_at = pg_catalog.now()
WHERE status IN ('aguardando_aprovacao', 'aguardando_pecas');

UPDATE public.service_orders
SET status = 'orcamento_aprovado', updated_at = pg_catalog.now()
WHERE status = 'orcamento_enviado'
  AND budget_status = 'aprovado'
  AND budget_approval_date IS NOT NULL;

ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_status_check
  CHECK (status IN (
    'recebido', 'em_diagnostico', 'orcamento_enviado', 'orcamento_aprovado',
    'em_manutencao', 'em_testes', 'concluido', 'pronto_retirada', 'entregue'
  ));

CREATE OR REPLACE FUNCTION public.approve_service_order_budget(p_os_number TEXT)
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
      status = 'orcamento_aprovado',
      budget_approval_date = v_now,
      budget_approval_notes = 'Aprovado pelo cliente na página pública da OS.',
      updated_at = v_now
  WHERE id = v_order_id;

  INSERT INTO public.service_order_history (
    id, service_order_id, actor_name, event_type, previous_value,
    new_value, public_message, created_at
  ) VALUES (
    pg_catalog.gen_random_uuid(), v_order_id, 'Cliente', 'status_change',
    v_previous_status, 'orcamento_aprovado',
    'Orçamento aprovado pelo cliente.', v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'approved', true,
    'order_number', v_order_number,
    'status', 'orcamento_aprovado',
    'budget_status', 'aprovado'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_service_order_budget(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_service_order_budget(TEXT)
  TO service_role;