import { ServiceOrderStatus, BudgetStatus, StoreSettings } from '../types';

export interface StatusConfig {
  key: ServiceOrderStatus;
  step: number;
  label: string;
  shortLabel: string;
  description: string;
  colorClass: string;
  bgLightClass: string;
  textColorClass: string;
}

export const STATUS_STEPS: Record<ServiceOrderStatus, StatusConfig> = {
  recebido: {
    key: 'recebido',
    step: 1,
    label: '1. Recebido na Loja',
    shortLabel: 'Recebido',
    description: 'Aparelho recebido na loja e cadastrado para triagem inicial.',
    colorClass: 'bg-zinc-500',
    bgLightClass: 'bg-zinc-500/10 text-zinc-300 border-zinc-700',
    textColorClass: 'text-zinc-400',
  },
  em_diagnostico: {
    key: 'em_diagnostico',
    step: 2,
    label: '2. Diagnóstico',
    shortLabel: 'Diagnóstico',
    description: 'A análise técnica do aparelho foi concluída e o orçamento está sendo preparado.',
    colorClass: 'bg-zinc-400',
    bgLightClass: 'bg-zinc-400/10 text-zinc-300 border-zinc-500/30',
    textColorClass: 'text-zinc-300',
  },
  orcamento_enviado: {
    key: 'orcamento_enviado',
    step: 3,
    label: '3. Orçamento Enviado',
    shortLabel: 'Orçamento Enviado',
    description: 'Orçamento calculado e disponibilizado para conferência do cliente.',
    colorClass: 'bg-zinc-500',
    bgLightClass: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
    textColorClass: 'text-zinc-300',
  },
  orcamento_aprovado: {
    key: 'orcamento_aprovado',
    step: 4,
    label: '4. Orçamento Aprovado',
    shortLabel: 'Orçamento Aprovado',
    description: 'O cliente aprovou o orçamento e o serviço pode seguir para manutenção.',
    colorClass: 'bg-zinc-500',
    bgLightClass: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
    textColorClass: 'text-zinc-300',
  },
  em_manutencao: {
    key: 'em_manutencao',
    step: 5,
    label: '5. Em Manutenção',
    shortLabel: 'Em Manutenção',
    description: 'Serviço técnico em andamento na bancada (troca de tela, conector, bateria, etc).',
    colorClass: 'bg-zinc-300',
    bgLightClass: 'bg-zinc-300/10 text-zinc-200 border-zinc-400/30',
    textColorClass: 'text-zinc-200',
  },
  em_testes: {
    key: 'em_testes',
    step: 6,
    label: '6. Em Testes',
    shortLabel: 'Em Testes',
    description: 'Reparo finalizado. Testes de qualidade, carga, toque, áudio e câmera em execução.',
    colorClass: 'bg-zinc-400',
    bgLightClass: 'bg-zinc-400/10 text-zinc-300 border-zinc-500/30',
    textColorClass: 'text-zinc-300',
  },
  concluido: {
    key: 'concluido',
    step: 7,
    label: '7. Concluído',
    shortLabel: 'Concluído',
    description: 'Todos os testes foram aprovados e o serviço foi finalizado com sucesso.',
    colorClass: 'bg-zinc-300',
    bgLightClass: 'bg-zinc-300/10 text-zinc-200 border-zinc-400/30',
    textColorClass: 'text-zinc-200',
  },
  pronto_retirada: {
    key: 'pronto_retirada',
    step: 8,
    label: '8. Pronto para Retirada',
    shortLabel: 'Pronto p/ Retirada',
    description: 'Aparelho pronto e higienizado aguardando o cliente na loja.',
    colorClass: 'bg-zinc-300',
    bgLightClass: 'bg-zinc-300/15 text-zinc-200 border-zinc-400/40 font-semibold',
    textColorClass: 'text-zinc-200',
  },
  entregue: {
    key: 'entregue',
    step: 9,
    label: '9. Entregue ao Cliente',
    shortLabel: 'Entregue',
    description: 'Aparelho entregue ao proprietário com termo de garantia ativado.',
    colorClass: 'bg-zinc-500',
    bgLightClass: 'bg-zinc-500/10 text-zinc-300 border-zinc-600',
    textColorClass: 'text-zinc-400',
  },
};

export const ORDERED_STATUS_LIST: ServiceOrderStatus[] = [
  'recebido',
  'em_diagnostico',
  'orcamento_enviado',
  'orcamento_aprovado',
  'em_manutencao',
  'em_testes',
  'concluido',
  'pronto_retirada',
  'entregue',
];

export const STATUS_STAGE: Record<ServiceOrderStatus, 'evaluation' | 'maintenance' | 'delivered'> = {
  recebido: 'evaluation',
  em_diagnostico: 'evaluation',
  orcamento_enviado: 'evaluation',
  orcamento_aprovado: 'evaluation',
  em_manutencao: 'maintenance',
  em_testes: 'maintenance',
  concluido: 'delivered',
  pronto_retirada: 'maintenance',
  entregue: 'delivered',
};

export const ORDER_STAGES = [
  { key: 'customer', label: 'Dados do Cliente', statuses: ['recebido'] },
  { key: 'device', label: 'Aparelho', statuses: ['em_diagnostico'] },
  { key: 'budget', label: 'Orçamento', statuses: ['orcamento_enviado', 'orcamento_aprovado'] },
  { key: 'finalization', label: 'Finalização', statuses: ['em_manutencao', 'em_testes', 'concluido', 'pronto_retirada', 'entregue'] },
] as const;

export const BUDGET_STATUS_CONFIG: Record<BudgetStatus, { label: string; badgeClass: string }> = {
  aguardando_orcamento: {
    label: 'Aguardando Orçamento',
    badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  },
  aguardando_aprovacao: {
    label: 'Orçamento Enviado',
    badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-600/40',
  },
  aprovado: {
    label: 'Orçamento Aprovado',
    badgeClass: 'bg-zinc-700 text-zinc-100 border-zinc-500/40',
  },
  recusado: {
    label: 'Orçamento Recusado',
    badgeClass: 'bg-zinc-900 text-zinc-300 border-zinc-700/40',
  },
  em_revisao: {
    label: 'Orçamento em Revisão',
    badgeClass: 'bg-zinc-800 text-zinc-300 border-zinc-600/40',
  },
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  store_name: 'Store Acessórios',
  document_cnpj: '42.890.123/0001-90',
  phone: '(11) 3456-7890',
  whatsapp: '5511998765432',
  email: 'contato@storeacessorios.com.br',
  address: 'Rua das Flores, 1420 - Centro Comercial',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  business_hours_week: 'Segunda a Sexta: 09:00 às 18:30',
  business_hours_saturday: 'Sábado: 09:00 às 14:00',
  default_warranty: 'Garantia legal de 90 (noventa) dias sobre as peças substituídas e mão de obra aplicada, conforme o Código de Defesa do Consumidor (Art. 26, II). A garantia não cobre danos por quedas, oxidação por contato com líquidos ou intervenção de terceiros.',
  pickup_instructions: 'Para a retirada do aparelho, apresente um documento oficial com foto ou este comprovante digital com o número da OS. Caso outra pessoa vá retirar em seu nome, favor avisar com antecedência pelo nosso WhatsApp.',
};
