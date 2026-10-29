import React from 'react';
import { ServiceOrderStatus, BudgetStatus } from '../types';
import { STATUS_STAGE, STATUS_STEPS, BUDGET_STATUS_CONFIG } from '../lib/constants';

interface StatusBadgeProps {
  status?: ServiceOrderStatus;
  budgetStatus?: BudgetStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  budgetStatus,
  size = 'md',
  showPulse = false,
}) => {
  if (status) {
    const config = STATUS_STEPS[status] || STATUS_STEPS.recebido;
    const tone = STATUS_STAGE[status];
    const isWorking = tone === 'maintenance';

    const sizeClasses = {
      sm: 'px-2 py-0.5 text-[11px]',
      md: 'px-2.5 py-1 text-xs',
      lg: 'px-3.5 py-1.5 text-sm font-semibold',
    };

    return (
      <span
        className={`sa-status-badge inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClasses[size]}`}
        data-tone={tone}
        aria-label={`Status da ordem: ${config.shortLabel}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            showPulse && isWorking ? 'animate-ping' : ''
          }`}
          aria-hidden="true"
          style={{ backgroundColor: `var(--sa-status-${tone})` }}
        />
        <span>{config.shortLabel}</span>
      </span>
    );
  }

  if (budgetStatus) {
    const config = BUDGET_STATUS_CONFIG[budgetStatus] || BUDGET_STATUS_CONFIG.aguardando_orcamento;
    const sizeClasses = {
      sm: 'px-2 py-0.5 text-[11px]',
      md: 'px-2.5 py-1 text-xs',
      lg: 'px-3 py-1.5 text-sm',
    };

    return (
      <span
        className={`sa-status-badge inline-flex items-center rounded-full border font-medium ${sizeClasses[size]}`}
        data-tone={budgetStatus === 'aprovado' ? 'success' : budgetStatus === 'recusado' ? 'danger' : budgetStatus === 'aguardando_orcamento' ? 'neutral' : 'attention'}
        aria-label={`Status do orçamento: ${config.label}`}
      >
        {config.label}
      </span>
    );
  }

  return null;
};
