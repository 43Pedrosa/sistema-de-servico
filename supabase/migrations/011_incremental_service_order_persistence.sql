-- Allow an OS to be saved and published before later form steps have collected their data.
-- The form and API validate each required field when its step is advanced.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS administrative_step SMALLINT NOT NULL DEFAULT 3,
  ALTER COLUMN customer_name DROP NOT NULL,
  ALTER COLUMN customer_phone DROP NOT NULL,
  ALTER COLUMN device_brand DROP NOT NULL,
  ALTER COLUMN device_model DROP NOT NULL,
  ALTER COLUMN customer_report DROP NOT NULL,
  ALTER COLUMN is_published SET DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
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
  'Zero-based administrative form step to resume; independent from repair status.';

-- is_published is the sole publication switch; form progress and repair status
-- do not control visibility. The view still exposes only its explicit safe list.
CREATE OR REPLACE VIEW public_service_orders_view AS
SELECT
  id, os_number, created_at, updated_at, status, budget_status,
  device_brand, device_model, device_color, accessories_received,
  customer_report, technical_diagnosis, required_services, required_parts,
  public_tech_notes, parts_cost, labor_cost, additional_costs, discount,
  total_amount, estimated_completion, estimated_delivery_date, is_delayed,
  delay_reason, delivered_at, warranty_description
FROM public.service_orders
WHERE is_published = true
  AND is_cancelled = false;

NOTIFY pgrst, 'reload schema';
