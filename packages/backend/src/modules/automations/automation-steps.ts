// Passos de um bot (coluna Automation.actions), executados em ordem pelo AutomationRunner.
// Textos e variáveis de template aceitam {{nome}} e {{primeiro_nome}} do contato.

export type AutomationStep =
  | { type: 'wait'; seconds: number }
  | { type: 'wait_reply'; timeoutSeconds?: number } // sem resposta até o limite → encerra o bot
  | { type: 'send_text'; text: string }
  | {
      type: 'send_template';
      templateName: string;
      language: string;
      parameterFormat?: 'POSITIONAL' | 'NAMED';
      bodyText?: string; // corpo do template, só para gravar o balão com o texto preenchido
      params?: { key: string; value: string }[]; // variáveis do corpo, na ordem
    }
  | { type: 'move_stage'; stageId?: string; stageName?: string };

export interface AutomationConditions {
  onlyPhones?: string[]; // modo teste: só dispara para esses números
}

export const STEP_TYPES = ['wait', 'wait_reply', 'send_text', 'send_template', 'move_stage'];

/** Espera por resposta sem limite configurado: 7 dias e o bot encerra. */
export const DEFAULT_REPLY_TIMEOUT_S = 7 * 24 * 3600;

export const TRIGGER_LABEL: Record<string, string> = {
  LEAD_FORM_SUBMITTED: 'Formulário do site preenchido',
  LEAD_STAGE_ENTERED: 'Card entrou na etapa do funil',
  ABANDONED_CART: 'Carrinho abandonado',
  ORDER_DELIVERED: 'Pedido entregue',
  ORDER_PAID: 'Pagamento confirmado',
  NEW_FOLLOWER: 'Novo seguidor no Instagram',
  CONTACT_DORMANT: 'Cliente sem compra há N dias',
  CONTACT_AT_RISK: 'Cliente em risco',
};

/**
 * Valida e limpa os passos vindos da tela. Lança Error com a mensagem para o usuário.
 * `strict` (bot ativo / teste) exige tudo preenchido; pausado pode ficar incompleto.
 */
export function sanitizeSteps(input: any, strict = true): AutomationStep[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('O bot precisa de pelo menos um passo.');
  if (input.length > 30) throw new Error('Máximo de 30 passos.');
  const secs = (v: any, max: number) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > max) throw new Error('Tempo de espera inválido.');
    return n;
  };
  return input.map((s: any): AutomationStep => {
    switch (s?.type) {
      case 'wait':
        return { type: 'wait', seconds: secs(s.seconds, 30 * 24 * 3600) };
      case 'wait_reply':
        return { type: 'wait_reply', ...(s.timeoutSeconds ? { timeoutSeconds: secs(s.timeoutSeconds, 90 * 24 * 3600) } : {}) };
      case 'send_text': {
        const text = String(s.text ?? '').trim();
        if (!text && strict) throw new Error('Mensagem de texto vazia.');
        return { type: 'send_text', text: text.slice(0, 4096) };
      }
      case 'send_template': {
        const templateName = String(s.templateName ?? '').trim();
        if (!templateName && strict) throw new Error('Escolha o template do WhatsApp.');
        return {
          type: 'send_template',
          templateName,
          language: String(s.language || 'pt_BR'),
          parameterFormat: s.parameterFormat === 'NAMED' ? 'NAMED' : 'POSITIONAL',
          bodyText: typeof s.bodyText === 'string' ? s.bodyText : undefined,
          params: Array.isArray(s.params)
            ? s.params.map((p: any) => ({ key: String(p?.key ?? ''), value: String(p?.value ?? '') }))
            : [],
        };
      }
      case 'move_stage':
        if (!s.stageId && !s.stageName && strict) throw new Error('Escolha a etapa do funil.');
        return { type: 'move_stage', ...(s.stageId ? { stageId: String(s.stageId) } : {}), ...(s.stageName ? { stageName: String(s.stageName) } : {}) };
      default:
        throw new Error(`Passo desconhecido: ${s?.type}`);
    }
  });
}
