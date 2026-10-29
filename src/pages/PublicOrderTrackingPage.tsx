import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Smartphone, Calendar, Clock, Wrench, Cpu, FileText,
  AlertTriangle, MessageCircle, MapPin, ShieldCheck, Printer,
} from 'lucide-react';
import { ServiceOrderPublic } from '../types';
import {
  fetchPublicOrderByOSNumber,
  getStoreSettings,
} from '../lib/storage';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { PhotoGallery } from '../components/PhotoGallery';
import { BudgetCard } from '../components/BudgetCard';

const formatDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const PublicOrderTrackingPage: React.FC = () => {
  const { osNumber } = useParams<{ osNumber: string }>();
  const [order, setOrder] = useState<ServiceOrderPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const settings = getStoreSettings();

  const loadOrder = useCallback(async (isCurrent: () => boolean = () => true, silent = false) => {
    if (!osNumber) {
      setError('Número de Ordem de Serviço não informado.');
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const raw = await fetchPublicOrderByOSNumber(osNumber);
      if (!isCurrent()) return;
      if (!raw) setError(`A Ordem de Serviço #${osNumber} não foi encontrada no sistema.`);
      else if (!raw.is_published) setError('Esta Ordem de Serviço ainda não foi liberada para consulta.');
      else if (raw.is_cancelled) setError('Esta Ordem de Serviço foi cancelada. Entre em contato com a loja.');
      else {
        const { is_published: _isPublished, is_cancelled: _isCancelled, ...publicOrder } = raw;
        setOrder(publicOrder);
      }
    } catch (cause) {
      if (!isCurrent()) return;
      console.error(cause);
      if (!silent) {
        setError(cause instanceof Error
          ? cause.message
          : 'Erro ao carregar os dados da Ordem de Serviço.');
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [osNumber]);

  useEffect(() => {
    let isCurrent = true;
    void loadOrder(() => isCurrent);
    const intervalId = window.setInterval(() => { void loadOrder(() => isCurrent, true); }, 10000);
    const refreshOnFocus = () => { void loadOrder(() => isCurrent, true); };
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [loadOrder]);

  const handleBudgetDecision = useCallback(async (orderNumber: string, decision: 'approve' | 'reject') => {
    let response: Response;
    try {
      response = await fetch('/api/approve-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, decision }),
      });
    } catch (cause) {
      console.error('Budget approval API request failed', cause);
      throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
    }

    const responseBody = await response.text();
    let result: { message?: string; status?: ServiceOrderPublic['status']; budgetStatus?: ServiceOrderPublic['budget_status'] };
    try {
      result = responseBody ? JSON.parse(responseBody) : {};
    } catch (cause) {
      console.error('Budget approval API returned a non-JSON response', cause);
      throw new Error(
        response.status === 404
          ? 'A API de aprovação não está disponível neste servidor. Reinicie o ambiente local com as configurações do Supabase ou publique a versão atualizada.'
          : 'O servidor não retornou uma resposta válida. Tente novamente.'
      );
    }

    if (!response.ok) {
      throw new Error(result.message || 'Não foi possível registrar a aprovação.');
    }
    const expectedStatus = decision === 'approve' ? 'orcamento_aprovado' : 'em_diagnostico';
    const expectedBudgetStatus = decision === 'approve' ? 'aprovado' : 'recusado';
    if (result.status !== expectedStatus || result.budgetStatus !== expectedBudgetStatus) {
      throw new Error('O servidor não confirmou a decisão do orçamento.');
    }

    await loadOrder();
  }, [loadOrder]);

  if (loading) {
    return (
      <div className="sa-public-page sa-tracking-page flex flex-1 flex-col items-center justify-center px-6 py-20" role="status" aria-live="polite">
        <span className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--sa-border)] border-t-[var(--sa-accent)]" aria-hidden="true" />
        <h1 className="text-lg font-bold">Carregando a OS #{osNumber}…</h1>
        <p className="sa-muted mt-1 text-sm">Buscando a atualização mais recente</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="sa-public-page sa-tracking-page flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <AlertTriangle className="mb-4 h-8 w-8 text-[var(--sa-warning)]" aria-hidden="true" />
        <h1 className="text-xl font-bold">Consulta não disponível</h1>
        <p className="sa-muted mb-6 mt-2 max-w-md text-sm leading-6">{error}</p>
        <Link to="/consultar" className="sa-secondary-button sa-focus"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar para consulta</Link>
      </div>
    );
  }

  const createdDate = formatDate(order.created_at);
  const updatedDate = formatDate(order.updated_at);
  const whatsappClean = (settings.whatsapp || '').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappClean}?text=${encodeURIComponent(
    `Olá, Store Acessórios! Estou acompanhando minha OS #${order.os_number}${order.device_brand || order.device_model ? ` (${[order.device_brand, order.device_model].filter(Boolean).join(' ')})` : ''} e gostaria de tirar uma dúvida.`
  )}`;
  const technicalDetails = [
    { title: 'Diagnóstico técnico', value: order.technical_diagnosis, icon: Cpu },
    { title: 'Serviços realizados ou recomendados', value: order.required_services, icon: Wrench },
    { title: 'Peças e componentes', value: order.required_parts, icon: FileText },
    { title: 'Observações ao cliente', value: order.public_tech_notes, icon: ShieldCheck },
  ].filter(item => Boolean(item.value?.trim()));
  const hasEstimate = Boolean(order.estimated_completion?.trim());

  return (
    <main className="sa-public-page sa-tracking-page mx-auto w-full max-w-[1200px] flex-1 space-y-6 px-5 py-7 sm:px-8 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <Link to="/consultar" className="sa-muted sa-focus inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium hover:text-[var(--sa-text)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Nova consulta
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="sa-secondary-button sa-focus"><Printer className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Imprimir</span></button>
        </div>
      </div>

      <section className="sa-surface p-5 sm:p-7" aria-labelledby="order-heading">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="sa-overline">Ordem de Serviço</p>
            <h1 id="order-heading" className="mt-1 font-mono text-3xl font-bold tracking-tight sm:text-4xl">#{order.os_number}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-base font-semibold">
              <Smartphone className="h-4 w-4 text-[var(--sa-accent)]" aria-hidden="true" />
              {[order.device_brand, order.device_model].filter(Boolean).join(' ') || 'Dados do aparelho pendentes'}
              {order.device_color && <span className="sa-muted text-sm font-normal">· {order.device_color}</span>}
            </p>
          </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
            <span className="sa-overline">Status atual</span>
            {order.budget_status === 'recusado'
              ? <StatusBadge budgetStatus={order.budget_status} size="lg" />
              : <StatusBadge status={order.status} size="lg" />}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--sa-border)] pt-4 text-xs">
          {createdDate && <p className="sa-muted inline-flex items-center gap-2"><Calendar className="h-4 w-4 text-[var(--sa-accent)]" aria-hidden="true" />Aberta em <span className="font-mono text-[var(--sa-text)]">{createdDate}</span></p>}
          {updatedDate && <p className="sa-muted inline-flex items-center gap-2"><Clock className="h-4 w-4 text-[var(--sa-success)]" aria-hidden="true" />Atualizada em <span className="font-mono text-[var(--sa-text)]">{updatedDate}</span></p>}
        </div>
      </section>

      <section className="sa-surface p-5 sm:p-7" aria-label="Etapas do reparo">
        <Timeline currentStatus={order.status} budgetStatus={order.budget_status} history={order.history} lastUpdated={order.updated_at} />
      </section>

      <section className="sa-surface p-5 sm:p-7" aria-label="Fotos do aparelho e do serviço">
        <PhotoGallery photos={order.photos} />
      </section>

      {(order.customer_report || order.accessories_received || technicalDetails.length > 0) && (
        <section className="sa-surface p-5 sm:p-7" aria-labelledby="details-heading">
          <div className="mb-5 border-b border-[var(--sa-border)] pb-4">
            <p className="sa-overline">Informações do atendimento</p>
            <h2 id="details-heading" className="mt-1 text-lg font-bold">Detalhes do reparo</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {order.customer_report && <div><h3 className="text-xs font-semibold">Relato inicial</h3><p className="sa-muted mt-2 whitespace-pre-line text-sm leading-6">{order.customer_report}</p></div>}
            {order.accessories_received && <div><h3 className="text-xs font-semibold">Acessórios recebidos</h3><p className="sa-muted mt-2 whitespace-pre-line text-sm leading-6">{order.accessories_received}</p></div>}
            {technicalDetails.map(({ title, value, icon: Icon }) => <div key={title}><h3 className="flex items-center gap-2 text-xs font-semibold"><Icon className="h-4 w-4 text-[var(--sa-accent)]" aria-hidden="true" />{title}</h3><p className="sa-muted mt-2 whitespace-pre-line text-sm leading-6">{value}</p></div>)}
          </div>
        </section>
      )}

      {(order.budget_status !== 'aguardando_orcamento' || order.total_amount > 0) && <section aria-label="Orçamento">
        <BudgetCard
          partsCost={order.parts_cost}
          laborCost={order.labor_cost}
          additionalCosts={order.additional_costs}
          discount={order.discount}
          totalAmount={order.total_amount}
          budgetStatus={order.budget_status}
          showStatusBadge={order.status !== 'orcamento_enviado' && order.status !== 'orcamento_aprovado' && order.budget_status !== 'recusado'}
          warrantyDescription={order.warranty_description}
          orderNumber={order.os_number}
          whatsappNumber={whatsappClean}
          onApproveBudget={orderNumber => handleBudgetDecision(orderNumber, 'approve')}
          onRejectBudget={orderNumber => handleBudgetDecision(orderNumber, 'reject')}
        />
      </section>}

      {(hasEstimate || order.is_delayed || order.status === 'pronto_retirada' || settings.pickup_instructions || settings.address || whatsappClean) && (
        <section className="sa-surface grid gap-5 p-5 sm:grid-cols-2 sm:p-7" aria-labelledby="next-steps-heading">
          <div>
            <p className="sa-overline">Próximos passos</p>
            <h2 id="next-steps-heading" className="mt-1 text-lg font-bold">Informações para acompanhar</h2>
            {hasEstimate && <div className="mt-4"><h3 className="text-xs font-semibold">Previsão de conclusão</h3><p className="mt-1 font-mono text-sm">{order.estimated_completion}</p></div>}
            {order.is_delayed && <div className="mt-4 flex items-start gap-2 text-sm text-[var(--sa-warning)]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{order.delay_reason || 'O prazo informado está sujeito a atualização.'}</p></div>}
            {order.status === 'pronto_retirada' && <p className="mt-4 text-sm font-semibold text-[var(--sa-success)]">O aparelho está disponível para retirada na loja.</p>}
            {settings.pickup_instructions && <p className="sa-muted mt-4 text-sm leading-6">{settings.pickup_instructions}</p>}
          </div>
          <div className="space-y-4 sm:border-l sm:border-[var(--sa-border)] sm:pl-6">
            {settings.address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sa-accent)]" aria-hidden="true" /><p className="sa-muted text-sm leading-6">{settings.address}<br />{settings.neighborhood} · {settings.city}/{settings.state}</p></div>}
            {settings.business_hours_week && <p className="sa-muted text-xs leading-5">{settings.business_hours_week}<br />{settings.business_hours_saturday}</p>}
            {whatsappClean && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="sa-primary-button sa-focus w-full sm:w-auto"><MessageCircle className="h-4 w-4" aria-hidden="true" />Falar com a loja</a>}
          </div>
        </section>
      )}
    </main>
  );
};
