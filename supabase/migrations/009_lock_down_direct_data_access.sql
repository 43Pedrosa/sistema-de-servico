-- Public order tracking must use the PII-filtered view, not the base table.
REVOKE ALL ON TABLE
  public.service_orders,
  public.service_order_items,
  public.store_settings,
  public.profiles,
  public.admin_sessions
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.service_order_photos, public.service_order_history
FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Admins full access to service_orders"
  ON public.service_orders;
DROP POLICY IF EXISTS "Admins full access to service_order_photos"
  ON public.service_order_photos;
DROP POLICY IF EXISTS "Admins full access to service_order_items"
  ON public.service_order_items;
DROP POLICY IF EXISTS "Admins full access to service_order_history"
  ON public.service_order_history;
DROP POLICY IF EXISTS "Admins full access to store_settings"
  ON public.store_settings;

GRANT SELECT ON public.public_service_orders_view TO anon;
GRANT SELECT (
  id,
  service_order_id,
  storage_path,
  url,
  caption,
  display_order,
  created_at
) ON public.service_order_photos TO anon;
GRANT SELECT (
  id,
  service_order_id,
  event_type,
  public_message,
  created_at
) ON public.service_order_history TO anon;

DROP POLICY IF EXISTS "Public read photos of published orders"
  ON public.service_order_photos;
CREATE POLICY "Public read photos of published orders"
  ON public.service_order_photos FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.public_service_orders_view
      WHERE public_service_orders_view.id = service_order_photos.service_order_id
    )
  );

DROP POLICY IF EXISTS "Public read public messages from history"
  ON public.service_order_history;
CREATE POLICY "Public read public messages from history"
  ON public.service_order_history FOR SELECT TO anon
  USING (
    public_message IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.public_service_orders_view
      WHERE public_service_orders_view.id = service_order_history.service_order_id
    )
  );

DROP POLICY IF EXISTS "Public read photos for published orders"
  ON storage.objects;
CREATE POLICY "Public read photos for published orders"
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'service-order-photos'
    AND EXISTS (
      SELECT 1
      FROM public.public_service_orders_view
      WHERE public_service_orders_view.id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Authenticated read service order photos"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload service order photos"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update service order photos"
  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete service order photos"
  ON storage.objects;
