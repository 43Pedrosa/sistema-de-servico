import { createClient } from '@supabase/supabase-js';
import { hasValidOrigin, type AdminRequest } from './_admin-auth.ts';

interface ApprovalRequest {
  method?: string;
  headers: AdminRequest['headers'];
  body?: unknown;
}

interface ApprovalResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApprovalResponse;
  json(body: unknown): void;
}

interface ApprovalRequestBody {
  orderNumber?: unknown;
  decision?: unknown;
}

interface ApprovalResult {
  approved?: boolean;
  rejected?: boolean;
  order_number?: string;
  status?: string;
  budget_status?: string;
}

export default async function handler(req: ApprovalRequest, res: ApprovalResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Método não permitido.' });
    return;
  }

  if (!hasValidOrigin(req)) {
    res.status(403).json({ message: 'Origem da solicitação não permitida.' });
    return;
  }

  const body = req.body as ApprovalRequestBody | undefined;
  if (
    typeof body?.orderNumber !== 'string' ||
    !/^[a-z0-9_-]{2,20}$/i.test(body.orderNumber.trim())
  ) {
    res.status(400).json({ message: 'Número da ordem de serviço inválido.' });
    return;
  }
  if (body.decision !== undefined && body.decision !== 'approve' && body.decision !== 'reject') {
    res.status(400).json({ message: 'Decisão de orçamento inválida.' });
    return;
  }
  const decision = body.decision === 'reject' ? 'reject' : 'approve';

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing server-side Supabase environment variables for budget approval.');
    res.status(503).json({ message: 'A aprovação online ainda não está configurada.' });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.rpc(
      decision === 'approve' ? 'approve_service_order_budget' : 'reject_service_order_budget',
      {
        p_os_number: body.orderNumber.trim(),
      }
    );

    if (error) {
      console.error('Supabase budget approval RPC failed:', error);
      res.status(500).json({ message: 'Não foi possível registrar a resposta ao orçamento. Tente novamente.' });
      return;
    }

    const result = data as ApprovalResult | null;
    if (!result || (decision === 'approve' ? !result.approved : !result.rejected)) {
      res.status(409).json({
        message: 'Este orçamento não está mais aguardando resposta. Atualize a página ou entre em contato com a loja.',
      });
      return;
    }

    res.status(200).json({
      message: decision === 'approve'
        ? `Orçamento da OS #${result.order_number} aprovado. O técnico já foi notificado.`
        : `Recusa do orçamento da OS #${result.order_number} registrada. A equipe entrará em contato para revisar as opções.`,
      decision,
      status: result.status,
      budgetStatus: result.budget_status,
    });
  } catch (error) {
    console.error('Unexpected budget response error:', error);
    res.status(500).json({ message: 'Ocorreu um erro ao registrar a resposta ao orçamento.' });
  }
}
