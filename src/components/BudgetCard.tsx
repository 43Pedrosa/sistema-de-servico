import React, { useState } from 'react';
import { DollarSign, ShieldCheck, Tag, Info, Check, MessageCircle } from 'lucide-react';
import { BudgetStatus } from '../types';
import { StatusBadge } from './StatusBadge';

interface BudgetCardProps {
  partsCost: number;
  laborCost: number;
  additionalCosts?: number;
  discount?: number;
  totalAmount: number;
  budgetStatus: BudgetStatus;
  showStatusBadge?: boolean;
  warrantyDescription?: string | null;
  orderNumber: string;
  whatsappNumber: string;
  onApproveBudget: (orderNumber: string) => Promise<void>;
  onRejectBudget: (orderNumber: string) => Promise<void>;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const BudgetCard: React.FC<BudgetCardProps> = ({
  partsCost,
  laborCost,
  additionalCosts = 0,
  discount = 0,
  totalAmount,
  budgetStatus,
  showStatusBadge = true,
  warrantyDescription,
  orderNumber,
  whatsappNumber,
  onApproveBudget,
  onRejectBudget,
}) => {
  const [responding, setResponding] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const formatCurrency = (val: number) => currencyFormatter.format(val || 0);
  const responseUrl = () => {
    const message = `Olá! Gostaria de falar sobre o orçamento da OS #${orderNumber}, no valor de ${formatCurrency(totalAmount)}.`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleApprove = async () => {
    if (responding) return;
    setResponding(true);
    setApprovalError(null);
    try {
      await onApproveBudget(orderNumber);
    } catch (error) {
      console.error('Failed to record customer budget approval', error);
      setApprovalError(error instanceof Error ? error.message : 'Não foi possível confirmar a aprovação.');
    } finally {
      setResponding(false);
    }
  };
  const handleReject = async () => {
    if (responding) return;
    setResponding(true);
    setApprovalError(null);
    try {
      await onRejectBudget(orderNumber);
    } catch (error) {
      console.error('Failed to record customer budget rejection', error);
      setApprovalError(error instanceof Error ? error.message : 'Não foi possível registrar a recusa.');
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="sa-surface p-5 sm:p-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sa-border)] pb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-[var(--sa-success)]" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold">Orçamento</h2>
            <p className="sa-muted text-xs">Valores informados para peças e serviços</p>
          </div>
        </div>
        {showStatusBadge && <StatusBadge budgetStatus={budgetStatus} size="md" />}
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4 text-[var(--sa-text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            Peças e Componentes de Reposição:
          </span>
          <span className="font-mono font-medium text-[var(--sa-text)]">{formatCurrency(partsCost)}</span>
        </div>

        <div className="flex items-center justify-between gap-4 text-[var(--sa-text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            Mão de Obra Técnica Especializada:
          </span>
          <span className="font-mono font-medium text-[var(--sa-text)]">{formatCurrency(laborCost)}</span>
        </div>

        {additionalCosts > 0 && (
          <div className="flex items-center justify-between gap-4 text-[var(--sa-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              Custos Adicionais (Insumos / Vedação):
            </span>
            <span className="font-mono font-medium text-[var(--sa-text)]">{formatCurrency(additionalCosts)}</span>
          </div>
        )}

        {discount > 0 && (
          <div className="flex justify-between items-center text-emerald-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Desconto Comercial Aplicado:
            </span>
            <span className="font-mono">- {formatCurrency(discount)}</span>
          </div>
        )}

        {/* Total Highlight */}
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-[var(--sa-border)] pt-4">
          <div>
            <span className="text-xs font-semibold">Valor total</span>
            <p className="sa-muted mt-1 text-[11px]">Condições de pagamento combinadas na loja</p>
          </div>
          <div className="text-right">
            <span className="font-mono text-xl font-bold tracking-tight text-[var(--sa-success)] sm:text-2xl">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Note about status */}
      <div className="sa-muted mt-4 flex items-start gap-2 border-t border-[var(--sa-border)] pt-4 text-xs leading-5">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="text-[var(--sa-text)]">Aviso:</strong> orçamento aprovado autoriza a execução do serviço, mas não confirma a quitação do pagamento.
        </p>
      </div>

      {budgetStatus === 'aguardando_aprovacao' && (
        <div className="mt-5 border-t border-[var(--sa-border)] pt-5">
          <h3 className="text-sm font-semibold">O que você achou do orçamento?</h3>
          <p className="sa-muted mt-1 text-xs leading-5">
            Ao aprovar, o status da ordem será atualizado e a equipe técnica será avisada.
          </p>
          <div className="budget-decision-actions mt-4">
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={responding}
              className="sa-primary-button sa-focus justify-center disabled:cursor-wait disabled:opacity-60"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {responding ? 'Registrando resposta...' : 'Aprovar orçamento'}
            </button>
            <button
              type="button"
              onClick={() => void handleReject()}
              disabled={responding}
              className="sa-secondary-button sa-focus justify-center disabled:cursor-wait disabled:opacity-60"
            >
              {responding ? 'Aguarde...' : 'Recusar orçamento'}
            </button>
          </div>
          {whatsappNumber && (
            <a
              href={responseUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-contact-button sa-focus mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.52 0 .19 5.33.18 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.31-1.66a11.9 11.9 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.33 11.89-11.89a11.8 11.8 0 0 0-3.43-8.42ZM12.06 21.77h-.01a9.9 9.9 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.89-9.89 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.89-9.88 9.89Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.89-.79-1.48-1.76-1.65-2.06-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.19.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.28.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
              </svg>
              WhatsApp
            </a>
          )}
          {approvalError && (
            <p className="mt-3 text-sm text-[var(--sa-warning)]" role="alert">{approvalError}</p>
          )}
          {whatsappNumber && (
            <p className="sa-muted mt-3 inline-flex items-center gap-1.5 text-xs">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Sua decisão é registrada diretamente no sistema.
            </p>
          )}
        </div>
      )}

      {warrantyDescription && (
        <div className="mt-4 flex items-start gap-2 border-t border-[var(--sa-border)] pt-4 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sa-success)]" aria-hidden="true" />
          <div>
            <span className="font-semibold text-[var(--sa-success)]">Garantia do serviço</span>
            <p className="sa-muted mt-1 leading-relaxed">{warrantyDescription}</p>
          </div>
        </div>
      )}
    </div>
  );
};
