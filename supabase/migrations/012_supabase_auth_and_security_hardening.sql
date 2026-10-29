-- Login stays server-side and independent from Supabase Auth and database profiles.
-- This migration only hardens public data access and adds supporting indexes.

-- The deployed database currently grants anon/authenticated access to confidential
-- service_orders columns. Remove broad grants before exposing only the public view.
REVOKE ALL ON TABLE
  public.service_orders,
  public.service_order_items,
  public.store_settings,
  public.profiles,
  public.admin_sessions
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.service_order_photos, public.service_order_history
FROM PUBLIC, anon, authenticated;

-- Postgres 15+ views should run with the caller's privileges so table RLS applies.
ALTER VIEW public.public_service_orders_view SET (security_invoker = true);
GRANT SELECT ON public.public_service_orders_view TO anon;

GRANT SELECT (
  id, service_order_id, storage_path, url, caption, display_order, created_at
) ON public.service_order_photos TO anon;
GRANT SELECT (
  id, service_order_id, event_type, public_message, created_at
) ON public.service_order_history TO anon;

-- The public view exposes only these non-PII columns. Row access is still limited by
-- the existing "Public read published orders only" RLS policy on service_orders.
GRANT SELECT (
  id,
  os_number,
  created_at,
  updated_at,
  status,
  budget_status,
  device_brand,
  device_model,
  device_color,
  accessories_received,
  customer_report,
  technical_diagnosis,
  required_services,
  required_parts,
  public_tech_notes,
  parts_cost,
  labor_cost,
  additional_costs,
  discount,
  total_amount,
  estimated_completion,
  estimated_delivery_date,
  is_delayed,
  delay_reason,
  delivered_at,
  warranty_description
) ON public.service_orders TO anon;

-- Cover foreign-key lookups used when deleting orders and loading their children.
CREATE INDEX IF NOT EXISTS idx_service_order_history_order_id
  ON public.service_order_history (service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_order_items_order_id
  ON public.service_order_items (service_order_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_technician_id
  ON public.service_orders (technician_id);

-- Avoid resolving names through a mutable search_path in the timestamp trigger.
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;
