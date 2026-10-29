ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS administrative_step SMALLINT NOT NULL DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_orders_administrative_step_check'
      AND conrelid = 'public.service_orders'::regclass
  ) THEN
    ALTER TABLE public.service_orders
      ADD CONSTRAINT service_orders_administrative_step_check
      CHECK (administrative_step BETWEEN 0 AND 8);
  END IF;
END;
$$;

COMMENT ON COLUMN public.service_orders.administrative_step IS
  'Zero-based administrative form step to resume; 8 means all form steps are complete.';

CREATE OR REPLACE FUNCTION public.reject_service_order_budget(p_os_number TEXT)
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
    RETURN pg_catalog.jsonb_build_object('rejected', false);
  END IF;

  UPDATE public.service_orders
  SET budget_status = 'recusado',
      status = 'em_diagnostico',
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
    'em_diagnostico',
    'Orçamento recusado pelo cliente. A equipe entrará em contato para revisar as opções.',
    v_now
  );

  RETURN pg_catalog.jsonb_build_object(
    'rejected', true,
    'order_number', v_order_number,
    'status', 'em_diagnostico',
    'budget_status', 'recusado'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_service_order_budget(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_service_order_budget(TEXT)
  TO service_role;
