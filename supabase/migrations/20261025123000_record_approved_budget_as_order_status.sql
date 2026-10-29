UPDATE public.service_order_history history
SET event_type = 'status_change',
    previous_value = 'orcamento_enviado',
    new_value = 'orcamento_aprovado',
    public_message = 'Orçamento aprovado pelo cliente.'
FROM public.service_orders orders
WHERE history.service_order_id = orders.id
  AND orders.status = 'orcamento_aprovado'
  AND orders.budget_status = 'aprovado'
  AND orders.budget_approval_date IS NOT NULL
  AND history.event_type = 'budget_change'
  AND history.new_value = 'aprovado'
  AND NOT EXISTS (
    SELECT 1 FROM public.service_order_history existing
    WHERE existing.service_order_id = orders.id
      AND existing.event_type = 'status_change'
      AND existing.new_value = 'orcamento_aprovado'
  );