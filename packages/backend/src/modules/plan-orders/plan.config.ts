import { appUrl } from '../scheduling/scheduling.service';

/**
 * Produto pago de entrada (plano de conteúdo de 3 meses). Nome, preço e prazo vêm do env
 * para trocar sem mexer no código: o nome final ainda vai ser decidido.
 */
export const planConfig = () => ({
  productName: process.env.PLAN_PRODUCT_NAME || 'Plano de Conteúdo 90 Dias',
  price: Number(process.env.PLAN_PRICE || 297),
  deliveryHours: Number(process.env.PLAN_DELIVERY_HOURS || 24),
  /** Tenant que vende o plano (a página pública não tem login). */
  tenantSlug: process.env.PLAN_TENANT_SLUG || 'dua-criativa',
  /** Etapa do funil para onde vai quem paga (opcional; sem ela o card fica onde está ou entra na 1ª etapa). */
  funnelStage: process.env.PLAN_FUNNEL_STAGE || '',
});

/** Caminho da página de venda no frontend (rota fixa do Next). */
export const PLAN_PAGE_PATH = '/plano-90-dias';
export const planPageUrl = () => `${appUrl()}${PLAN_PAGE_PATH}`;
export const planOrderUrl = (token: string) => `${appUrl()}${PLAN_PAGE_PATH}/pedido/${token}`;
export const planPdfUrl = (token: string) => `${appUrl()}/api/v1/public/plano/pedido/${token}/pdf`;

/** Tags do contato no CRM. */
export const PLAN_TAGS = { ordered: 'plano-90d-pedido', paid: 'plano-90d-pago' };

export const PLAN_STATUSES = ['AWAITING_PAYMENT', 'PAID', 'IN_PRODUCTION', 'IN_REVIEW', 'DELIVERED', 'CANCELED'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** Opções dos campos de escolha do formulário (o frontend recebe daqui). */
export const PLAN_FORM_OPTIONS = {
  quemPosta: ['Eu mesma(o)', 'Alguém da equipe', 'Freelancer', 'Agência', 'Ninguém posta com frequência'],
  verba: ['Até R$ 500/mês', 'R$ 500 a R$ 1.500/mês', 'R$ 1.500 a R$ 3.000/mês', 'Acima de R$ 3.000/mês', 'Ainda não tenho verba'],
};

export interface PlanAnswers {
  nicho: string;
  ticket: string;
  publico: string;
  quemPosta: string;
  verba: string;
  observacoes?: string;
}
