-- Private photo storage for service orders.
-- Run after 001_initial_schema.sql.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-order-photos',
  'service-order-photos',
  false,
  5242880,
  ARRAY['image/webp', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read photos for published orders"
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'service-order-photos'
    AND EXISTS (
      SELECT 1
      FROM public.service_orders
      WHERE service_orders.id::text = (storage.foldername(name))[1]
        AND service_orders.is_published = true
        AND service_orders.is_cancelled = false
    )
  );

CREATE POLICY "Authenticated read service order photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'service-order-photos');

CREATE POLICY "Authenticated upload service order photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'service-order-photos'
    AND EXISTS (
      SELECT 1
      FROM public.service_orders
      WHERE service_orders.id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Authenticated update service order photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'service-order-photos')
  WITH CHECK (bucket_id = 'service-order-photos');

CREATE POLICY "Authenticated delete service order photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-order-photos');
