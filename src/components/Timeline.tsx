import React from 'react';
import { Check, Clock, AlertCircle } from 'lucide-react';
import { BudgetStatus, ServiceOrderStatus } from '../types';

const ORDER_STAGES = [
  { title: 'Dados do Cliente', description: 'Identificação e contato do cliente.', statuses: ['recebido'] },
  { title: 'Aparelho', description: 'Identificação do aparelho e avaliação dos defeitos.', statuses: ['em_diagnostico'] },
  { title: 'Orçamento', description: 'Valores, prazo, fotos e decisão do cliente.', statuses: ['orcamento_enviado', 'orcamento_aprovado'] },
  { title: 'Finalização', description: 'Execução, testes, conclusão e entrega do aparelho.', statuses: ['em_manutencao', 'em_testes', 'concluido', 'pronto_retirada', 'entregue'] },
] as const;
const PROGRESS_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#16a34a'];
const FINALIZATION_STATUSES: ServiceOrderStatus[] = ['em_manutencao', 'em_testes', 'concluido', 'pronto_retirada', 'entregue'];

interface TimelineProps {
  currentStatus: ServiceOrderStatus;
  budgetStatus: BudgetStatus;
  history?: Array<{
    id: string;
    event_type: string;
    public_message?: string;
    created_at: string;
    previous_value?: string;
    new_value?: string;
  }>;
  lastUpdated?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ currentStatus, budgetStatus, history = [], lastUpdated }) => {
  const isFinalizationStatus = FINALIZATION_STATUSES.includes(currentStatus);
  const currentIndex = isFinalizationStatus
    ? 3
    : ['aguardando_aprovacao', 'aprovado', 'recusado', 'em_revisao'].includes(budgetStatus)
      ? 2
      : Math.max(0, ORDER_STAGES.findIndex(stage => stage.statuses.some(status => status === currentStatus)));
  const historyByStage = new Map<number, (typeof history)[number]>();

  for (const event of history) {
    if (event.event_type === 'status_change') {
      const stageIndex = ORDER_STAGES.findIndex(stage => stage.statuses.some(status => status === event.new_value));
      if (stageIndex >= 0 && !historyByStage.has(stageIndex)) historyByStage.set(stageIndex, event);
    }
  }
  const createdEvent = history.find(event => event.event_type === 'created');
  if (createdEvent && !historyByStage.has(0)) historyByStage.set(0, createdEvent);
  const budgetEvent = history.find(event => event.public_message?.toLowerCase().includes('orçamento recusado'));
  if (budgetEvent && budgetStatus === 'recusado') historyByStage.set(2, budgetEvent);

  return (
    <div className="w-full">
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-[var(--sa-border)] pb-4">
        <div>
          <p className="sa-overline">Acompanhamento</p>
          <h2 className="mt-1 text-lg font-bold">Etapas da OS</h2>
          <p className="sa-muted mt-1 text-xs">Atualizações registradas para esta OS</p>
        </div>
        <span className="sa-muted whitespace-nowrap text-xs">
          Etapa <strong className="text-[var(--sa-text)]">{currentIndex + 1}</strong> de {ORDER_STAGES.length}
        </span>
      </div>

      <ol className="relative ml-2 space-y-0">
        {ORDER_STAGES.map((stage, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isCompletedFinalization = isCurrent && index === 3 && ['concluido', 'pronto_retirada', 'entregue'].includes(currentStatus);
          const isSuccessfulCompletion = isCompletedFinalization;
          const stepColor = PROGRESS_COLORS[index];
          const nextStepColor = PROGRESS_COLORS[index + 1] || stepColor;
          const event = historyByStage.get(index);
          const timestamp = event?.created_at || (isCurrent ? lastUpdated : undefined);
          const date = timestamp ? new Date(timestamp) : null;
          const validDate = date && !Number.isNaN(date.getTime());

          return (
            <li key={stage.title} className={`relative flex gap-4 pb-5 last:pb-0 ${index > currentIndex ? 'opacity-55' : ''}`}>
              {index < ORDER_STAGES.length - 1 && (
                <span
                  className="absolute bottom-0 left-[9px] top-6 w-0.5"
                  style={{
                    background: isPast
                      ? `linear-gradient(to bottom, ${stepColor}, ${nextStepColor})`
                      : 'var(--sa-border)',
                  }}
                  aria-hidden="true"
                />
              )}
              <span
                className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                style={{
                  borderColor: isPast || isCurrent ? stepColor : 'var(--sa-border)',
                  backgroundColor: isPast || isCompletedFinalization ? stepColor : 'var(--sa-surface)',
                  color: isPast || isCompletedFinalization ? '#ffffff' : isCurrent ? stepColor : 'transparent',
                  boxShadow: isCurrent ? `0 0 0 4px color-mix(in srgb, ${stepColor} 22%, transparent)` : undefined,
                }}
                aria-label={isCompletedFinalization || isPast ? 'Etapa concluída' : isCurrent ? 'Etapa atual' : 'Etapa futura'}
              >
                {(isPast || isCompletedFinalization) && <Check className="h-3 w-3" aria-hidden="true" />}
                {isCurrent && !isCompletedFinalization && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h3 className={`text-sm ${isSuccessfulCompletion ? 'font-bold' : 'font-semibold'}`} style={isCurrent ? { color: stepColor } : undefined}>
                    {index === 2 && budgetStatus === 'aprovado' ? 'Orçamento aprovado' : index === 2 && budgetStatus === 'recusado' ? 'Orçamento recusado' : stage.title}
                  </h3>
                  {validDate && <time className="sa-muted inline-flex items-center gap-1.5 font-mono text-[11px]" dateTime={date!.toISOString()}><Clock className="h-3 w-3" aria-hidden="true" />{date!.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>}
                </div>
                {isCurrent && <p className="sa-muted mt-1 text-xs leading-5">{stage.description}</p>}
                {event?.public_message && (
                  <p className={`mt-2 flex items-start gap-2 border-l-2 pl-3 text-xs leading-5 ${isSuccessfulCompletion ? 'border-emerald-600 bg-emerald-500/10 py-2 font-semibold text-emerald-700' : 'sa-muted border-[var(--sa-warning)]'}`}>
                    {isSuccessfulCompletion
                      ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--sa-warning)]" aria-hidden="true" />}
                    {event.public_message}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
