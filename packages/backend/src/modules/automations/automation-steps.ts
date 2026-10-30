// Passos de um bot (coluna Automation.actions), executados em ordem pelo AutomationRunner.
// Cada passo tem um `id` estável; desvios ("ir para") apontam para esse id.
// Textos aceitam {{nome}}, {{primeiro_nome}}, {{canal_venda}}, {{modelo_venda}}, {{faturamento}}, {{origem}} e {{respostas}}.
// Nos bots de reunião também {{reuniao_data}}, {{reuniao_hora}}, {{meet}}, {{link_remarcar}} e {{link_agendamento}}.

/** Destino de um desvio: vazio = próximo passo, "end" = encerra o bot, senão o id de um passo. */
export type StepTarget = string | undefined;

/** Espera que termina no próximo dia útil (seg–sex) nesse horário de Brasília, ex.: "10:00"; com alignWeekends, em qualquer dia. */
type Align = { alignTo?: string; alignWeekends?: boolean };

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
  | { type: 'check_origin'; onKnown?: StepTarget; onUnknown?: StepTarget } // já sabemos de onde o contato veio?
  | { type: 'set_origin'; origin: LeadOrigin; source?: string } // grava a origem (ex.: resposta de um botão)
  | { type: 'goto'; target: StepTarget }
  | { type: 'end' }
  // Reunião (gatilho "Reunião agendada"): espera até `seconds` antes/depois do início.
  // Remarcou → vale o novo horário. Já passou ao chegar aqui → segue por onLate (pula o lembrete).
  | { type: 'wait_meeting'; seconds: number; when: 'before' | 'after'; onTime?: StepTarget; onLate?: StepTarget }
  // Depois da reunião: espera o time marcar "realizada" ou "não compareceu" (até timeoutSeconds após o fim; sem onTimeout → encerra)
  | { type: 'meeting_status'; timeoutSeconds?: number; onDone?: StepTarget; onNoShow?: StepTarget; onTimeout?: StepTarget }
  // Depois de mandar o link de agendamento: espera a pessoa marcar a reunião, com lembretes próprios
  // (contados a partir deste passo). Agendou → onBooked; escreveu algo → onReply; sem agendar → onTimeout (vazio = encerra).
  | { type: 'wait_booking'; timeoutSeconds?: number; reminders?: Reminder[]; giveUpSeconds?: number; onBooked?: StepTarget; onReply?: StepTarget; onTimeout?: StepTarget }
);

/** Passos que só funcionam com uma reunião na sessão. */
export const MEETING_STEPS = ['wait_meeting', 'meeting_status'];

/** Margem para "na hora" da espera da reunião (laço de 5s, reinício do servidor). */
export const MEETING_LATE_GRACE_MS = 15 * 60_000;

/** Prazo padrão para o time marcar o status da reunião depois do fim. */
export const DEFAULT_MEETING_STATUS_TIMEOUT_S = 24 * 3600;

/** Momento da espera relativa à reunião. */
export function meetingWaitAt(startAt: Date, step: { seconds: number; when: 'before' | 'after' }) {
  return new Date(startAt.getTime() + (step.when === 'before' ? -1 : 1) * step.seconds * 1000);
}

/** Contact.leadOrigin */
export type LeadOrigin = 'ADS' | 'ORGANIC' | 'REFERRAL' | 'OTHER';
export const LEAD_ORIGINS: LeadOrigin[] = ['ADS', 'ORGANIC', 'REFERRAL', 'OTHER'];

/**
 * Lembrete para quem não respondeu: `afterSeconds` depois que o bot começou a esperar a resposta.
 * Texto só sai com a janela de 24h aberta (senão é pulado); template sai sempre.
 */
export type Reminder = { afterSeconds: number } & (
  | { type: 'send_text'; text: string }
  | { type: 'send_template'; templateName: string; language: string; parameterFormat?: 'POSITIONAL' | 'NAMED'; bodyText?: string; params?: { key: string; value: string }[] }
);

export interface AutomationConditions {
  onlyPhones?: string[]; // modo teste: só dispara para esses números
  reminders?: Reminder[]; // valem para toda espera por resposta do bot, em ordem de tempo
  giveUpSeconds?: number; // depois do último lembrete, quanto esperar antes do "sem resposta"
  stageId?: string; // gatilho LEAD_STAGE_ENTERED: a etapa que dispara o bot
}

/** Sem resposta depois do último lembrete: espera isso e segue pelo "sem resposta". */
export const DEFAULT_GIVE_UP_S = 2 * 24 * 3600;

/** Margem antes de a janela de 24h do WhatsApp fechar (texto livre deixa de chegar). */
export const WINDOW_MS = 24 * 3600_000 - 10 * 60_000;

/** Lembrete não sai de madrugada: entre 21h e 9h (Brasília) vai para as 9h. */
export function businessHours(d: Date) {
  const OFFSET = 3 * 3600_000;
  const local = new Date(d.getTime() - OFFSET);
  const h = local.getUTCHours();
  if (h >= 9 && h < 21) return d;
  const at = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 9, 0));
  if (h >= 21) at.setUTCDate(at.getUTCDate() + 1);
  return new Date(at.getTime() + OFFSET);
}

/**
 * Agenda de uma espera por resposta que começou em `since`: quando sai o próximo lembrete
 * (null = já saíram todos) e quando vence o "sem resposta". Com lembretes, o prazo do passo
 * só vale se for depois do último lembrete + `giveUpSeconds`.
 */
export function waitPlan(
  since: Date,
  sent: number,
  step: { timeoutSeconds?: number; alignTo?: string; alignWeekends?: boolean },
  cond: AutomationConditions,
) {
  const timeoutAt = waitUntil(since, step.timeoutSeconds || DEFAULT_REPLY_TIMEOUT_S, step.alignTo, step.alignWeekends);
  const reminders = cond.reminders ?? [];
  if (!reminders.length) return { reminderAt: null, deadline: timeoutAt };
  const at = (r: Reminder) => businessHours(new Date(since.getTime() + r.afterSeconds * 1000));
  const afterLast = at(reminders[reminders.length - 1]).getTime() + (cond.giveUpSeconds ?? DEFAULT_GIVE_UP_S) * 1000;
  return {
    reminderAt: sent < reminders.length ? at(reminders[sent]) : null,
    deadline: new Date(Math.max(timeoutAt.getTime(), afterLast)),
  };
}

/**
 * Qual lembrete sai agora: o mais recente já vencido (null = nenhum). Se vários venceram juntos
 * (lembretes ligados depois que a espera começou, servidor fora do ar), só o último sai.
 */
export function dueReminder(since: Date, sent: number, cond: AutomationConditions, now: number) {
  const reminders = cond.reminders ?? [];
  let due: number | null = null;
  for (let k = sent; k < reminders.length; k++) {
    if (businessHours(new Date(since.getTime() + reminders[k].afterSeconds * 1000)).getTime() <= now) due = k;
  }
  return due;
}

/** Depois do último lembrete enviado, a pessoa tem pelo menos `giveUpSeconds` para responder. */
export function giveUpAfter(sentAt: number, cond: AutomationConditions) {
  return new Date(sentAt + (cond.giveUpSeconds ?? DEFAULT_GIVE_UP_S) * 1000);
}

/** Valida os lembretes vindos da tela (até 5, em ordem de tempo, até 30 dias). */
export function sanitizeReminders(input: any, strict = true): Reminder[] {
  if (!Array.isArray(input)) return [];
  if (input.length > 5) throw new Error('Máximo de 5 lembretes.');
  const out = input.map((r: any): Reminder => {
    const afterSeconds = Math.round(Number(r?.afterSeconds));
    if (!Number.isFinite(afterSeconds) || afterSeconds < 60 || afterSeconds > 30 * 24 * 3600) {
      throw new Error('Tempo do lembrete inválido (de 1 minuto a 30 dias).');
    }
    if (r?.type === 'send_template') {
      const templateName = String(r.templateName ?? '').trim();
      if (!templateName && strict) throw new Error('Escolha o template do lembrete.');
      return {
        afterSeconds,
        type: 'send_template',
        templateName,
        language: String(r.language || 'pt_BR'),
        parameterFormat: r.parameterFormat === 'NAMED' ? 'NAMED' : 'POSITIONAL',
        ...(typeof r.bodyText === 'string' ? { bodyText: r.bodyText } : {}),
        params: Array.isArray(r.params) ? r.params.map((p: any) => ({ key: String(p?.key ?? ''), value: String(p?.value ?? '') })) : [],
      };
    }
    const text = String(r?.text ?? '').trim();
    if (!text && strict) throw new Error('Lembrete de texto vazio.');
    return { afterSeconds, type: 'send_text', text: text.slice(0, 1024) };
  });
  return out.sort((a, b) => a.afterSeconds - b.afterSeconds);
}

export const STEP_TYPES = ['wait', 'wait_reply', 'send_text', 'send_template', 'send_buttons', 'move_stage', 'add_tag', 'notify', 'check_origin', 'set_origin', 'goto', 'end', 'wait_booking', ...MEETING_STEPS];

/** Espera pelo agendamento sem prazo configurado: 2 dias. */
export const DEFAULT_BOOKING_TIMEOUT_S = 2 * 24 * 3600;

/** Espera por resposta sem limite configurado: 7 dias e o bot encerra. */
export const DEFAULT_REPLY_TIMEOUT_S = 7 * 24 * 3600;

export const TRIGGER_LABEL: Record<string, string> = {
  LEAD_FORM_SUBMITTED: 'Formulário do site preenchido',
  WHATSAPP_FIRST_MESSAGE: 'Primeira mensagem no WhatsApp',
  MEETING_SCHEDULED: 'Reunião agendada',
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
  const align = (s: any) => {
    const v = s?.alignTo;
    if (!v) return {};
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) throw new Error('Horário inválido (use HH:MM).');
    return { alignTo: String(v), ...(s.alignWeekends === true ? { alignWeekends: true } : {}) };
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
        return { ...base, type: 'wait', seconds: secs(s.seconds, 30 * 24 * 3600), ...align(s) };
      case 'wait_reply':
        return {
          ...base,
          type: 'wait_reply',
          ...(s.timeoutSeconds ? { timeoutSeconds: secs(s.timeoutSeconds, 90 * 24 * 3600) } : {}),
          ...align(s),
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
          ...align(s),
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
      case 'check_origin':
        return { ...base, type: 'check_origin', ...opt('onKnown', s.onKnown), ...opt('onUnknown', s.onUnknown) };
      case 'set_origin': {
        if (!LEAD_ORIGINS.includes(s.origin)) throw new Error('Escolha a origem do contato.');
        const source = String(s.source ?? '').trim().toLowerCase().slice(0, 40);
        return { ...base, type: 'set_origin', origin: s.origin, ...(source ? { source } : {}) };
      }
      case 'goto': {
        const t = target(s.target);
        if (!t && strict) throw new Error('Escolha para qual passo o bot vai.');
        return { ...base, type: 'goto', target: t };
      }
      case 'end':
        return { ...base, type: 'end' };
      case 'wait_meeting':
        return {
          ...base,
          type: 'wait_meeting',
          seconds: secs(s.seconds, 30 * 24 * 3600),
          when: s.when === 'after' ? 'after' : 'before',
          ...opt('onTime', s.onTime),
          ...opt('onLate', s.onLate),
        };
      case 'meeting_status':
        return {
          ...base,
          type: 'meeting_status',
          ...(s.timeoutSeconds ? { timeoutSeconds: secs(s.timeoutSeconds, 30 * 24 * 3600) } : {}),
          ...opt('onDone', s.onDone),
          ...opt('onNoShow', s.onNoShow),
          ...opt('onTimeout', s.onTimeout),
        };
      case 'wait_booking':
        return {
          ...base,
          type: 'wait_booking',
          ...(s.timeoutSeconds ? { timeoutSeconds: secs(s.timeoutSeconds, 30 * 24 * 3600) } : {}),
          reminders: sanitizeReminders(s.reminders, strict),
          ...(s.giveUpSeconds ? { giveUpSeconds: secs(s.giveUpSeconds, 30 * 24 * 3600) } : {}),
          ...opt('onBooked', s.onBooked),
          ...opt('onReply', s.onReply),
          ...opt('onTimeout', s.onTimeout),
        };
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
 * Com `weekends`, vale qualquer dia (sábado e domingo também).
 */
export function waitUntil(from: Date, seconds: number, alignTo?: string, weekends = false) {
  const end = new Date(from.getTime() + seconds * 1000);
  if (!alignTo) return end;
  const [h, m] = alignTo.split(':').map(Number);
  const OFFSET = 3 * 3600_000;
  const local = new Date(end.getTime() - OFFSET); // relógio de Brasília nos campos UTC
  const at = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m));
  if (at < local) at.setUTCDate(at.getUTCDate() + 1);
  while (!weekends && (at.getUTCDay() === 0 || at.getUTCDay() === 6)) at.setUTCDate(at.getUTCDate() + 1);
  return new Date(at.getTime() + OFFSET);
}

/** Compara a resposta com o texto do botão ignorando maiúsculas, acentos, emoji e pontuação. */
export function sameAnswer(a: string, b: string) {
  const norm = (s: string) =>
    (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return !!norm(a) && norm(a) === norm(b);
}

/**
 * Textos prontos dos links de WhatsApp (wa.me/…?text=…): cada link abre a conversa com uma
 * frase que diz de onde a pessoa veio. Só reconhece essas frases, não adivinha.
 */
const ORIGIN_PHRASES: { re: RegExp; origin: LeadOrigin; utmSource: string; utmMedium: string }[] = [
  { re: /\bvim pelo instagram\b/, origin: 'ORGANIC', utmSource: 'instagram', utmMedium: 'bio' },
  { re: /\bvim pelo site\b/, origin: 'ORGANIC', utmSource: 'site', utmMedium: 'botao_whatsapp' },
  { re: /\bvi o anuncio\b/, origin: 'ADS', utmSource: 'anuncio', utmMedium: 'link_whatsapp' },
  { re: /\b(fui indicad[oa]|me indicaram|me indicou|vim por indicacao)\b/, origin: 'REFERRAL', utmSource: 'indicacao', utmMedium: 'whatsapp' },
];

export function originFromText(text: string | null | undefined) {
  const t = (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const hit = ORIGIN_PHRASES.find((p) => p.re.test(t));
  return hit ? { leadOrigin: hit.origin, utmSource: hit.utmSource, utmMedium: hit.utmMedium } : null;
}

/** Origem por extenso para {{origem}} nos textos e avisos. */
export function originLabel(c: { leadOrigin: string | null; utmSource: string | null; adHeadline?: string | null }) {
  const src = (c.utmSource || '').toLowerCase();
  switch (c.leadOrigin) {
    case 'ADS': return c.adHeadline ? `Anúncio — ${c.adHeadline}` : src === 'meta_ads' ? 'Anúncio da Meta' : 'Anúncio';
    case 'REFERRAL': return 'Indicação';
    case 'ORGANIC': return src.includes('instagram') ? 'Instagram' : src === 'site' ? 'Site' : 'Orgânico';
    case 'OTHER': return 'Outra';
    default: return 'não informada';
  }
}
