import { getAdminDataClient } from './_supabase-admin.ts';
import type { AdminRequest, AdminResponse } from './_admin-auth.ts';

const PHOTO_BUCKET = 'service-order-photos';
const PHOTO_URL_TTL_SECONDS = 60 * 60;
const PUBLIC_ORDER_COLUMNS = [
  'id', 'os_number', 'created_at', 'updated_at', 'status', 'budget_status',
  'device_brand', 'device_model', 'device_color', 'accessories_received',
  'customer_report', 'technical_diagnosis', 'required_services', 'required_parts',
  'public_tech_notes', 'parts_cost', 'labor_cost', 'additional_costs', 'discount',
  'total_amount', 'estimated_completion', 'estimated_delivery_date', 'is_delayed',
  'delay_reason', 'delivered_at', 'warranty_description',
].join(',');

interface PublicPhotoRow {
  id: string;
  service_order_id: string;
  storage_path: string;
  caption: string | null;
  display_order: number;
  created_at: string;
}

interface PublicHistoryRow {
  id: string;
  event_type: string;
  public_message: string | null;
  created_at: string;
  previous_value: string | null;
  new_value: string | null;
}

export default async function handler(req: AdminRequest, res: AdminResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ message: 'Método não permitido.' });
    return;
  }

  const queryNumber = req.query?.osNumber;
  const osNumber = Array.isArray(queryNumber) ? queryNumber[0] : queryNumber;
  if (!osNumber || !/^[a-z0-9_-]{2,20}$/i.test(osNumber.trim())) {
    res.status(400).json({ message: 'Número da ordem de serviço inválido.' });
    return;
  }

  try {
    const client = getAdminDataClient();
    const { data: row, error } = await client
      .from('public_service_orders_view')
      .select(PUBLIC_ORDER_COLUMNS)
      .eq('os_number', osNumber.trim())
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      res.status(404).json({ order: null });
      return;
    }
    const publicOrder = row as unknown as Record<string, unknown> & { id: string };

    const [{ data: photos, error: photosError }, { data: history, error: historyError }] = await Promise.all([
      client
        .from('service_order_photos')
        .select('id,service_order_id,storage_path,caption,display_order,created_at')
        .eq('service_order_id', publicOrder.id)
        .order('display_order', { ascending: true }),
      client
        .from('service_order_history')
        .select('id,event_type,public_message,created_at,previous_value,new_value')
        .eq('service_order_id', publicOrder.id)
        .not('public_message', 'is', null)
        .order('created_at', { ascending: false }),
    ]);
    if (photosError) throw photosError;
    if (historyError) throw historyError;

    const publicPhotos = await Promise.all(((photos || []) as unknown as PublicPhotoRow[]).map(async photo => {
      const { data, error: signedUrlError } = await client.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(photo.storage_path, PHOTO_URL_TTL_SECONDS);
      if (signedUrlError) throw signedUrlError;
      return {
        id: photo.id,
        service_order_id: photo.service_order_id,
        url: data.signedUrl,
        caption: photo.caption,
        display_order: photo.display_order,
        created_at: photo.created_at,
      };
    }));

    res.status(200).json({
      order: {
        ...publicOrder,
        is_published: true,
        is_cancelled: false,
        photos: publicPhotos,
        history: (history || []) as unknown as PublicHistoryRow[],
      },
    });
  } catch (error) {
    console.error('Public order lookup failed:', error);
    const missingConfiguration = error instanceof Error &&
      error.message.includes('Missing server-side Supabase environment variables');
    res.status(503).json({
      message: missingConfiguration
        ? 'A consulta pública compartilhada não está configurada no servidor.'
        : 'Não foi possível consultar a ordem agora. Tente novamente mais tarde.',
    });
  }
}
