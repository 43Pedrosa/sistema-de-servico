import { randomUUID } from 'node:crypto';
import { getAdminSession, hasValidOrigin, type AdminRequest, type AdminResponse } from './_admin-auth.ts';
import { getAdminDataClient } from './_supabase-admin.ts';

const PHOTO_BUCKET = 'service-order-photos';
const PHOTO_URL_TTL_SECONDS = 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = new Set([
  'recebido', 'em_diagnostico', 'orcamento_enviado', 'orcamento_aprovado',
  'em_manutencao', 'em_testes', 'concluido', 'pronto_retirada', 'entregue',
]);
const VALID_BUDGET_STATUSES = new Set([
  'aguardando_orcamento', 'aguardando_aprovacao', 'aprovado', 'recusado', 'em_revisao',
]);
const INCREMENTAL_ORDER_COLUMNS = new Set([
  'customer_name', 'customer_phone', 'device_brand', 'device_model', 'customer_report',
]);
const NULLABLE_TIMESTAMP_COLUMNS = new Set([
  'budget_approval_date',
  'estimated_delivery_date',
  'delivered_at',
]);
const STAGED_TEXT_COLUMNS = new Set([
  'customer_name', 'customer_phone', 'customer_whatsapp', 'customer_notes',
  'device_brand', 'device_model', 'device_color', 'device_imei_serial',
  'accessories_received', 'physical_condition_intake', 'customer_report',
  'technical_diagnosis', 'required_services', 'required_parts', 'internal_notes',
  'public_tech_notes', 'budget_approval_notes', 'estimated_completion',
  'delay_reason', 'warranty_description',
]);
const ORDER_COLUMNS = [
  'id', 'os_number', 'created_at', 'updated_at', 'status', 'budget_status',
  'administrative_step',
  'technician_name', 'customer_name', 'customer_phone', 'customer_whatsapp', 'customer_notes',
  'device_brand', 'device_model', 'device_color', 'device_imei_serial', 'accessories_received',
  'physical_condition_intake', 'customer_report', 'technical_diagnosis', 'required_services',
  'required_parts', 'internal_notes', 'public_tech_notes', 'parts_cost', 'labor_cost',
  'additional_costs', 'discount', 'total_amount', 'budget_approval_date', 'budget_approval_notes',
  'estimated_completion', 'estimated_delivery_date', 'is_delayed', 'delay_reason', 'delivered_at',
  'warranty_description', 'is_published', 'is_cancelled',
] as const;
const STATUS_LABELS: Record<string, string> = {
  recebido: 'Recebido',
  em_diagnostico: 'Diagnóstico',
  orcamento_enviado: 'Orçamento enviado',
  orcamento_aprovado: 'Orçamento aprovado',
  em_manutencao: 'Em manutenção',
  em_testes: 'Em testes',
  concluido: 'Concluído',
  pronto_retirada: 'Pronto para retirada',
  entregue: 'Entregue',
};

async function addSignedPhotoUrls(client: ReturnType<typeof getAdminDataClient>, rows: Record<string, unknown>[]) {
  return Promise.all(rows.map(async row => {
    const photos = Array.isArray(row.photos) ? row.photos as Array<Record<string, unknown>> : [];
    const signedPhotos = await Promise.all(photos.map(async photo => {
      const path = typeof photo.storage_path === 'string' ? photo.storage_path : '';
      if (!path || path.startsWith('/uploads/')) return photo;
      const { data, error } = await client.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, PHOTO_URL_TTL_SECONDS);
      if (error) throw error;
      return { ...photo, url: data.signedUrl };
    }));
    return { ...row, photos: signedPhotos };
  }));
}

async function syncPhotos(
  client: ReturnType<typeof getAdminDataClient>,
  orderId: string,
  photosValue: unknown
): Promise<void> {
  if (photosValue === undefined) return;
  if (!Array.isArray(photosValue) || photosValue.length > 20) {
    throw new Error('Lista de fotos inválida ou acima do limite.');
  }

  const photos = photosValue as Array<Record<string, unknown>>;
  const { data: existing, error: queryError } = await client
    .from('service_order_photos')
    .select('id, storage_path')
    .eq('service_order_id', orderId);
  if (queryError) throw queryError;

  const rows: Array<Record<string, unknown>> = [];
  const uploadedPaths: string[] = [];
  let recordsSaved = false;
  try {
    for (const photo of photos) {
      if (typeof photo.id !== 'string' || !UUID_PATTERN.test(photo.id)) {
        throw new Error('Identificador de foto inválido.');
      }
      let storagePath = typeof photo.storage_path === 'string' ? photo.storage_path : '';
      const url = typeof photo.url === 'string' ? photo.url : '';
      if (url.startsWith('data:image/')) {
        const match = /^data:image\/(webp|png|jpeg);base64,([a-zA-Z0-9+/]+=*)$/.exec(url);
        if (!match) throw new Error('Formato de imagem inválido.');
        const image = Buffer.from(match[2], 'base64');
        if (image.length > 5 * 1024 * 1024) throw new Error('Imagem acima do limite de 5 MB.');
        const mime = `image/${match[1]}`;
        const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
        storagePath = `${orderId}/${photo.id}.${extension}`;
        const { error } = await client.storage
          .from(PHOTO_BUCKET)
          .upload(storagePath, image, { contentType: mime, upsert: true });
        if (error) throw error;
        uploadedPaths.push(storagePath);
      }
      if (!storagePath || storagePath.startsWith('/uploads/')) {
        throw new Error('A foto ainda não foi enviada ao armazenamento seguro.');
      }
      rows.push({
        id: photo.id,
        service_order_id: orderId,
        storage_path: storagePath,
        url: storagePath,
        caption: typeof photo.caption === 'string' ? photo.caption.slice(0, 200) : null,
        display_order: Number.isInteger(photo.display_order) ? photo.display_order : 0,
        created_at: typeof photo.created_at === 'string' && photo.created_at.trim()
          ? photo.created_at
          : new Date().toISOString(),
      });
    }

    if (rows.length) {
      const { error } = await client.from('service_order_photos').upsert(rows);
      if (error) throw error;
    }
    recordsSaved = true;

    const retainedIds = new Set(rows.map(photo => photo.id));
    const removed = (existing || []).filter(photo => !retainedIds.has(photo.id));
    if (removed.length) {
      const { error: storageError } = await client.storage
        .from(PHOTO_BUCKET)
        .remove(removed.map(photo => photo.storage_path));
      if (storageError) throw storageError;
      const { error: deleteError } = await client
        .from('service_order_photos')
        .delete()
        .in('id', removed.map(photo => photo.id));
      if (deleteError) throw deleteError;
    }
  } catch (error) {
    if (!recordsSaved && uploadedPaths.length) {
      const { error: cleanupError } = await client.storage.from(PHOTO_BUCKET).remove(uploadedPaths);
      if (cleanupError) console.error('Failed to clean up uploaded service order photos', cleanupError);
    }
    throw error;
  }
}

export default async function handler(req: AdminRequest, res: AdminResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');
  if (!['GET', 'PUT', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, PUT, DELETE');
    res.status(405).json({ message: 'Método não permitido.' });
    return;
  }
  if (req.method !== 'GET' && !hasValidOrigin(req)) {
    res.status(403).json({ message: 'Origem da solicitação não permitida.' });
    return;
  }

  try {
    const session = await getAdminSession(req);
    if (!session) {
      res.status(401).json({ message: 'Sessão administrativa inválida ou expirada.' });
      return;
    }
    const client = getAdminDataClient();

    if (req.method === 'GET') {
      const { data, error } = await client
        .from('service_orders')
        .select('*, photos:service_order_photos(*), history:service_order_history(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []).filter(row => !['os-1687-uuid', 'os-1688-uuid', 'os-1689-uuid'].includes(row.id));
      res.status(200).json({ orders: await addSignedPhotoUrls(client, rows) });
      return;
    }

    if (req.method === 'DELETE') {
      if (session.profile.role !== 'admin') {
        res.status(403).json({ message: 'Somente um administrador pode excluir ordens de serviço.' });
        return;
      }
      const queryId = req.query?.id;
      const id = Array.isArray(queryId) ? queryId[0] : queryId;
      if (!id || !UUID_PATTERN.test(id)) {
        res.status(400).json({ message: 'Identificador da ordem inválido.' });
        return;
      }
      const { error } = await client.from('service_orders').delete().eq('id', id);
      if (error) throw error;
      res.status(200).json({ deleted: true });
      return;
    }

    const body = req.body as { order?: unknown } | undefined;
    if (!body?.order || typeof body.order !== 'object' || Array.isArray(body.order)) {
      res.status(400).json({ message: 'Dados da ordem inválidos.' });
      return;
    }
    const order = body.order as Record<string, unknown>;
    if (typeof order.os_number !== 'string' || !/^[a-z0-9_-]{2,20}$/i.test(order.os_number.trim())) {
      res.status(400).json({ message: 'Número da ordem inválido.' });
      return;
    }
    if (
      order.administrative_step !== undefined &&
      (!Number.isInteger(order.administrative_step) || Number(order.administrative_step) < 0 || Number(order.administrative_step) > 4)
    ) {
      res.status(400).json({ message: 'Etapa administrativa inválida.' });
      return;
    }
    if (order.status !== undefined && (typeof order.status !== 'string' || !VALID_STATUSES.has(order.status))) {
      res.status(400).json({ message: 'Status da ordem inválido.' });
      return;
    }
    if (order.budget_status !== undefined && (typeof order.budget_status !== 'string' || !VALID_BUDGET_STATUSES.has(order.budget_status))) {
      res.status(400).json({ message: 'Status do orçamento inválido.' });
      return;
    }
    for (const column of ['is_published', 'is_cancelled', 'is_delayed']) {
      if (order[column] !== undefined && typeof order[column] !== 'boolean') {
        res.status(400).json({ message: `O campo ${column} deve ser verdadeiro ou falso.` });
        return;
      }
    }
    for (const column of ['parts_cost', 'labor_cost', 'additional_costs', 'discount', 'total_amount']) {
      if (order[column] !== undefined && (typeof order[column] !== 'number' || !Number.isFinite(order[column]))) {
        res.status(400).json({ message: `O campo ${column} deve conter um valor numérico válido.` });
        return;
      }
    }
    if (order.expected_updated_at !== undefined && (
      typeof order.expected_updated_at !== 'string' || !Number.isFinite(Date.parse(order.expected_updated_at))
    )) {
      res.status(400).json({ message: 'Versão atual da OS inválida. Recarregue os dados e tente novamente.' });
      return;
    }

    // Check the deployed PostgREST schema before attempting a staged write.
    const { error: schemaError } = await client.from('service_orders')
      .select('id,os_number,administrative_step,technician_name,customer_name,customer_phone,device_brand,device_model,customer_report,is_published')
      .limit(0);
    if (schemaError) throw schemaError;

    if (order.id !== undefined && (typeof order.id !== 'string' || !UUID_PATTERN.test(order.id))) {
      res.status(400).json({ message: 'Identificador da ordem inválido.' });
      return;
    }
    const proposedId = typeof order.id === 'string' ? order.id : null;
    const previousColumns = '*, photos:service_order_photos(*), history:service_order_history(*)';
    const { data: byNumber, error: numberError } = await client
      .from('service_orders').select(previousColumns).eq('os_number', order.os_number.trim()).maybeSingle();
    if (numberError) throw numberError;
    const { data: byId, error: idError } = proposedId
      ? await client.from('service_orders').select(previousColumns).eq('id', proposedId).maybeSingle()
      : { data: null, error: null };
    if (idError) throw idError;
    if (byNumber && byId && byNumber.id !== byId.id) {
      res.status(409).json({ message: 'O número da OS pertence a outro registro. Atualize a lista e tente novamente.' });
      return;
    }
    const previous = byId || byNumber;
    if (proposedId && previous && previous.id !== proposedId) {
      res.status(409).json({ message: 'O identificador e o número da OS não correspondem ao mesmo registro.' });
      return;
    }
    if (previous && previous.os_number !== order.os_number.trim()) {
      res.status(409).json({ message: 'O identificador e o número da OS não correspondem ao mesmo registro.' });
      return;
    }
    const orderId = proposedId || (previous?.id as string | undefined) || randomUUID();
    const expectedUpdatedAt = typeof order.expected_updated_at === 'string' ? order.expected_updated_at : null;
    delete order.expected_updated_at;
    if (previous && expectedUpdatedAt && previous.updated_at !== expectedUpdatedAt) {
      res.status(409).json({ message: 'Esta OS foi alterada em outra sessão. Recarregue os dados antes de salvar novamente.' });
      return;
    }
    const now = new Date().toISOString();
    const values: Record<string, unknown> = {};
    if (!previous) {
      values.id = orderId;
      values.os_number = order.os_number.trim();
      values.created_at = typeof order.created_at === 'string' && order.created_at.trim() ? order.created_at : now;
      values.technician_name = typeof order.technician_name === 'string' && order.technician_name.trim()
        ? order.technician_name.trim()
        : session.profile.name;
      if (session.profile.id) values.technician_id = session.profile.id;
      values.administrative_step = 0;
      values.is_published = true;
    }
    for (const column of ORDER_COLUMNS) {
      if (column === 'id' || column === 'os_number' || column === 'created_at' || column === 'updated_at' || column === 'technician_name' || column === 'administrative_step') continue;
      if (order[column] !== undefined) {
        const value = order[column];
        if (NULLABLE_TIMESTAMP_COLUMNS.has(column) && typeof value === 'string' && !value.trim()) {
          values[column] = null;
        } else if (STAGED_TEXT_COLUMNS.has(column) && typeof value === 'string' && !value.trim()) {
          values[column] = null;
        } else {
          values[column] = value;
        }
      }
    }
    // New OS records become publicly searchable as soon as the first stage is saved.
    if (!previous) values.is_published = true;
    if (previous && typeof order.technician_name === 'string' && order.technician_name.trim()) {
      values.technician_name = order.technician_name.trim();
    } else if (previous) {
      values.technician_name = previous.technician_name;
    }
    if (session.profile.id) values.technician_id = session.profile.id;

    const requestedAdministrativeStep = typeof order.administrative_step === 'number'
      ? order.administrative_step
      : undefined;
    const nextStep = typeof requestedAdministrativeStep === 'number'
      ? requestedAdministrativeStep
      : Number(previous?.administrative_step ?? 0);
    // Completing the device stage means the technical diagnosis is complete.
    if (
      nextStep >= 2 &&
      ['recebido', 'em_diagnostico'].includes(String(values.status ?? previous?.status ?? 'recebido'))
    ) {
      values.status = 'em_diagnostico';
    }
    const resultingValue = (column: string) => values[column] !== undefined ? values[column] : previous?.[column];
    if (nextStep >= 1) {
      const missing = ['customer_name', 'customer_phone'].filter(column => !String(resultingValue(column) || '').trim());
      if (missing.length) {
        res.status(400).json({ message: 'Informe nome e telefone do cliente antes de avançar para a etapa Aparelho.' });
        return;
      }
    }
    if (nextStep >= 2) {
      const missing = ['device_brand', 'device_model', 'customer_report'].filter(column => !String(resultingValue(column) || '').trim());
      if (missing.length) {
        res.status(400).json({ message: 'Informe marca, modelo e relato inicial do aparelho antes de avançar para Orçamento.' });
        return;
      }
    }
    if (
      ['em_manutencao', 'em_testes', 'concluido', 'pronto_retirada', 'entregue']
        .includes(String(resultingValue('status') || '')) &&
      resultingValue('budget_status') !== 'aprovado'
    ) {
      res.status(409).json({ message: 'A execução só pode começar depois que o cliente aprovar o orçamento.' });
      return;
    }

    let savedRow: Record<string, unknown>;
    if (previous) {
      let updateQuery = client.from('service_orders').update(values).eq('id', orderId);
      if (expectedUpdatedAt) updateQuery = updateQuery.eq('updated_at', expectedUpdatedAt);
      const { data: updated, error: updateError } = await updateQuery
        .select('id, os_number, status, budget_status, administrative_step, is_published, is_cancelled, updated_at')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) {
        res.status(409).json({ message: 'Esta OS foi alterada em outra sessão. Recarregue os dados antes de salvar novamente.' });
        return;
      }
      savedRow = updated;
    } else {
      const { data: inserted, error: insertError } = await client.from('service_orders').insert(values)
        .select('id, os_number, status, budget_status, administrative_step, is_published, is_cancelled, updated_at')
        .single();
      if (insertError) throw insertError;
      savedRow = inserted;
    }

    let history: Record<string, unknown> | null = null;
    if (!previous) {
      history = {
        service_order_id: orderId,
        actor_name: session.profile.name,
        event_type: 'created',
        public_message: 'Ordem de serviço cadastrada no sistema Store Acessórios.',
        created_at: now,
      };
    } else if (previous.status !== savedRow.status) {
      history = {
        service_order_id: orderId,
        actor_name: session.profile.name,
        event_type: 'status_change',
        previous_value: previous.status,
        new_value: String(savedRow.status),
        public_message: `Status atualizado para: ${STATUS_LABELS[String(savedRow.status)] || String(savedRow.status)}. ${typeof order.public_tech_notes === 'string' ? order.public_tech_notes : ''}`.trim(),
        created_at: now,
      };
    } else if (previous.budget_status !== savedRow.budget_status && typeof order.budget_status === 'string') {
      history = {
        service_order_id: orderId,
        actor_name: session.profile.name,
        event_type: 'budget_change',
        previous_value: previous.budget_status,
        new_value: String(savedRow.budget_status),
        public_message: `Orçamento atualizado para ${String(savedRow.budget_status).toUpperCase()}.`,
        created_at: now,
      };
    }
    if (history) {
      const { error } = await client.from('service_order_history').insert(history);
      if (error) throw error;
    }

    await syncPhotos(client, orderId, order.photos);
    if (savedRow.is_published && !savedRow.is_cancelled) {
      const { data: publicOrder, error: publicOrderError } = await client
        .from('public_service_orders_view')
        .select('id, os_number')
        .eq('os_number', savedRow.os_number)
        .maybeSingle();
      if (publicOrderError) throw publicOrderError;
      if (!publicOrder) {
        res.status(503).json({
          message: 'A OS foi salva, mas não foi localizada na consulta pública. Verifique a publicação e tente novamente.',
        });
        return;
      }
    }
    if (requestedAdministrativeStep !== undefined) {
      let stepQuery = client.from('service_orders')
        .update({ administrative_step: requestedAdministrativeStep })
        .eq('id', orderId)
        .eq('updated_at', savedRow.updated_at);
      const { data: stepSaved, error: stepError } = await stepQuery
        .select('id, updated_at, administrative_step')
        .maybeSingle();
      if (stepError) throw stepError;
      if (!stepSaved) {
        res.status(409).json({ message: 'A OS foi atualizada durante o salvamento. Recarregue os dados antes de continuar.' });
        return;
      }
    }
    const { data: saved, error: savedError } = await client
      .from('service_orders')
      .select('*, photos:service_order_photos(*), history:service_order_history(*)')
      .eq('id', orderId)
      .single();
    if (savedError) throw savedError;
    const [savedWithSignedPhotos] = await addSignedPhotoUrls(client, [saved]);
    res.status(200).json({ order: savedWithSignedPhotos });
  } catch (error) {
    const dbError = error as { code?: string; message?: string; details?: string; hint?: string };
    console.error('Administrative order API failed:', {
      code: dbError?.code, message: dbError?.message, details: dbError?.details, hint: dbError?.hint,
    });
    if (dbError?.code === '23505') {
      res.status(409).json({ message: 'Já existe uma OS com esse número. Atualize a lista e tente novamente.' });
      return;
    }
    if (dbError?.code === '23502') {
      const missingColumn = dbError.message?.match(/null value in column "([^"]+)"/i)?.[1];
      if (missingColumn && INCREMENTAL_ORDER_COLUMNS.has(missingColumn)) {
        res.status(503).json({
          message: `O esquema Supabase ainda exige ${missingColumn} na criação da OS. Aplique a migração 011_incremental_service_order_persistence.sql e tente novamente.`,
        });
        return;
      }
      res.status(400).json({ message: 'O banco rejeitou um campo obrigatório. Consulte o registro técnico do servidor para identificar a coluna.' });
      return;
    }
    if (dbError?.code === 'PGRST204' || dbError?.code === 'PGRST200') {
      res.status(503).json({ message: 'O esquema do banco não está sincronizado com a API. Aplique as migrações pendentes e atualize o cache do Supabase.' });
      return;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '22007'
    ) {
      res.status(400).json({ message: 'Uma das datas informadas é inválida. Confira as datas e tente novamente.' });
      return;
    }
    res.status(503).json({ message: 'Não foi possível concluir a operação administrativa.' });
  }
}

