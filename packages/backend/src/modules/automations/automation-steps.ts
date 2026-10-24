// Passos de um bot (coluna Automation.actions), executados em ordem pelo AutomationRunner.
// Cada passo tem um `id` estável; desvios ("ir para") apontam para esse id.
// Textos aceitam {{nome}}, {{primeiro_nome}}, {{canal_venda}}, {{modelo_venda}}, {{faturamento}} e {{respostas}}.

/** Destino de um desvio: vazio = próximo passo, "end" = encerra o bot, senão o id de um passo. */
export type StepTarget = string | undefined;

/** Espera que termina no próximo dia útil (seg–sex) nesse horário de Brasília, ex.: "10:00". */
type Align = { alignTo?: string };

/** Posição do cartão no editor visual (não afeta a execução). */
export type StepPos = { x: number; y: number };

export type AutomationStep = { id?: string; name?: string; pos?: StepPos } & (
  | ({ type: 'wait'; seconds: number } & Align)
  | ({ type: 'wait_reply'; timeoutSeconds?: number; onReply?: StepTarget; onTimeout?: StepTarget } & Align) // sem onTimeout → encerra
  | { type: 'send_text'; text: string }
  | {
      type: 'send_template';
      templateName: string;
      language: string;
      parameterFormat?: 'POSITIONAL' | 'NAMED';
      bodyText?: string; // corpo do template, só para gravar o balão com o texto preenchido
      params?: { key: string; value: string }[]; // variáveis do corpo, na ordem
    }
  | ({
      // Mensagem com botões (até 3) e espera a escolha; cada botão pode desviar para um passo
      type: 'send_buttons';
      text: string;
      buttons: { title: string; goto?: StepTarget }[];
      onOther?: StepTarget; // respondeu escrevendo em vez de tocar num botão
      timeoutSeconds?: number;
      onTimeout?: StepTarget;
    } & Align)
  | { type: 'move_stage'; stageId?: string; stageName?: string }
  | { type: 'add_tag'; tag: string }
  | { type: 'notify'; text: string; to?: string } // nota interna na conversa + notificação nos aparelhos
  | { type: 'goto'; target: StepTarget }
  | { type: 'end' }
);

export interface AutomationConditions {
  onlyPhones?: string[]; // modo teste: só dispara para esses números
}

export const STEP_TYPES = ['wait', 'wait_reply', 'send_text', 'send_template', 'send_buttons', 'move_stage', 'add_tag', 'notify', 'goto', 'end'];

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

const newId = () => `s${Math.random().toString(36).slice(2, 8)}`;

/**
 * Valida e limpa os passos vindos da tela. Lança Error com a mensagem para o usuário.
 * `strict` (bot ativo / teste) exige tudo preenchido; pausado pode ficar incompleto.
 */
export function sanitizeSteps(input: any, strict = true): AutomationStep[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('O bot precisa de pelo menos um passo.');
  if (input.length > 40) throw new Error('Máximo de 40 passos.');
  const secs = (v: any, max: number) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0 || n > max) throw new Error('Tempo de espera inválido.');
    return n;
  };
  const align = (v: any) => {
    if (!v) return {};
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) throw new Error('Horário inválido (use HH:MM).');
    return { alignTo: String(v) };
  };

  // Ids primeiro, para validar os desvios
  const ids: string[] = [];
  for (const s of input) {
    let id = typeof s?.id === 'string' && /^[\w-]{1,40}$/.test(s.id) ? s.id : newId();
    while (ids.includes(id)) id = newId();
    ids.push(id);
  }
  const target = (v: any): StepTarget => {
    if (!v) return undefined;
    const t = String(v);
    if (t === 'end' || ids.includes(t)) return t;
    if (strict) throw new Error('Um desvio aponta para um passo que não existe mais.');
    return undefined;
  };
  // Só grava o campo de desvio quando ele existe
  const opt = (key: string, v: any) => {
    const t = target(v);
    return t ? { [key]: t } : {};
  };

  return input.map((s: any, i: number): AutomationStep => {
    const base: { id: string; name?: string; pos?: StepPos } = { id: ids[i] };
    const name = String(s?.name ?? '').trim().slice(0, 60);
    if (name) base.name = name;
    const x = Number(s?.pos?.x), y = Number(s?.pos?.y);
    if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6) base.pos = { x: Math.round(x), y: Math.round(y) };
    switch (s?.type) {
      case 'wait':
        return { ...base, type: 'wait', seconds: secs(s.seconds, 30 * 24 * 3600), ...align(s.alignTo) };
      case 'wait_reply':
        return {
          ...base,
          type: 'wait_reply',
          ...(s.timeoutSeconds ? { timeoutSeconds: secs(s.timeoutSeconds, 90 * 24 * 3600) } : {}),
          ...align(s.alignTo),
          ...opt('onReply', s.onReply),
          ...opt('onTimeout', s.onTimeout),
        };
      case 'send_text': {
        const text = String(s.text ?? '').trim();
        if (!text && strict) throw new Error('Mensagem de texto vazia.');
        return { ...base, type: 'send_text', text: text.slice(0, 4096) };
      }
      case 'send_template': {
        const templateName = String(s.templateName ?? '').trim();
        if (!templateName && strict) throw new Error('Escolha o template do WhatsApp.');
        return {
          ...base,
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
      case 'send_buttons': {
        const text = String(s.text ?? '').trim();
        if (!text && strict) throw new Error('Mensagem com botões sem texto.');
        if (text.length > 1024) throw new Error('A mensagem com botões passa de 1024 caracteres.');
        const buttons = (Array.isArray(s.buttons) ? s.buttons : [])
          .map((b: any) => ({ title: String(b?.title ?? '').trim(), ...opt('goto', b?.goto) }))
          .filter((b: any) => b.title || !strict);
        if (strict && (buttons.length < 1 || buttons.length > 3)) throw new Error('Use de 1 a 3 botões.');
        if (buttons.some((b: any) => b.title.length > 20)) throw new Error('Texto do botão com mais de 20 caracteres (limite do WhatsApp).');
        if (new Set(buttons.map((b: any) => b.title.toLowerCase())).size !== buttons.length) throw new Error('Botões repetidos.');
        return {
          ...base,
          type: 'send_buttons',
          text,
          buttons: buttons.slice(0, 3),
          ...opt('onOther', s.onOther),
          ...(s.timeoutSeconds ? { timeoutSeconds: secs(s.timeoutSeconds, 90 * 24 * 3600) } : {}),
          ...align(s.alignTo),
          ...opt('onTimeout', s.onTimeout),
        };
      }
      case 'move_stage':
        if (!s.stageId && !s.stageName && strict) throw new Error('Escolha a etapa do funil.');
        return { ...base, type: 'move_stage', ...(s.stageId ? { stageId: String(s.stageId) } : {}), ...(s.stageName ? { stageName: String(s.stageName) } : {}) };
      case 'add_tag': {
        const tag = String(s.tag ?? '').trim().slice(0, 60);
        if (!tag && strict) throw new Error('Etiqueta vazia.');
        return { ...base, type: 'add_tag', tag };
      }
      case 'notify': {
        const text = String(s.text ?? '').trim();
        if (!text && strict) throw new Error('Aviso para o time sem texto.');
        const to = String(s.to ?? '').trim().slice(0, 40);
        return { ...base, type: 'notify', text: text.slice(0, 2000), ...(to ? { to } : {}) };
      }
      case 'goto': {
        const t = target(s.target);
        if (!t && strict) throw new Error('Escolha para qual passo o bot vai.');
        return { ...base, type: 'goto', target: t };
      }
      case 'end':
        return { ...base, type: 'end' };
      default:
        throw new Error(`Passo desconhecido: ${s?.type}`);
    }
  });
}

/** Frase do modelo de venda do formulário, para "Vi aqui que vocês vendem {{canal_venda}}". */
export function salesChannelPhrase(model: string | null | undefined) {
  const m = (model || '').toLowerCase();
  if (!m) return '';
  if (m.includes('instagram') || m.includes('whatsapp')) return 'pelo Instagram e WhatsApp';
  if (m.includes('e-commerce') || m.includes('ecommerce') || m.includes('site')) return 'pelo site de vocês';
  if (m.includes('física') || m.includes('fisica')) return 'na loja física e online';
  if (m.includes('atacado')) return 'no atacado';
  if (m.includes('marketplace')) return 'em marketplaces';
  return '';
}

/**
 * Fim de uma espera: `seconds` a partir de `from` e, com `alignTo`, empurrado para o
 * próximo dia útil (seg–sex) nesse horário de Brasília (UTC-3, sem horário de verão).
 */
export function waitUntil(from: Date, seconds: number, alignTo?: string) {
  const end = new Date(from.getTime() + seconds * 1000);
  if (!alignTo) return end;
  const [h, m] = alignTo.split(':').map(Number);
  const OFFSET = 3 * 3600_000;
  const local = new Date(end.getTime() - OFFSET); // relógio de Brasília nos campos UTC
  const at = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m));
  if (at < local) at.setUTCDate(at.getUTCDate() + 1);
  while (at.getUTCDay() === 0 || at.getUTCDay() === 6) at.setUTCDate(at.getUTCDate() + 1);
  return new Date(at.getTime() + OFFSET);
}

/** Compara a resposta com o texto do botão ignorando maiúsculas, acentos, emoji e pontuação. */
export function sameAnswer(a: string, b: string) {
  const norm = (s: string) =>
    (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return !!norm(a) && norm(a) === norm(b);
}
