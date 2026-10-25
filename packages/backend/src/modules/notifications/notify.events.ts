/** Tipos de aviso que o CRM gera. Cada um tem chave própria em Configurações → Notificações. */
export const NOTIFY_EVENTS = {
  lead_new: { label: 'Novo lead captado', sub: 'Quando um contato novo entra no funil (formulário, anúncio, WhatsApp, Instagram)' },
  message_whatsapp: { label: 'Nova mensagem no WhatsApp', sub: 'Mensagem recebida de um contato' },
  message_instagram: { label: 'Nova mensagem no Instagram', sub: 'DM recebida no Instagram' },
  meeting: { label: 'Reuniões', sub: 'Reunião agendada, cancelada ou remarcada' },
  team_note: { label: 'Recados do time e dos bots', sub: 'Nota para um colega e avisos de bot' },
  payment_received: { label: 'Pagamento recebido', sub: 'Cobrança paga no Asaas' },
  payment_overdue: { label: 'Pagamento atrasado', sub: 'Cobrança vencida no Asaas' },
  contract_expiring: { label: 'Contrato vencendo', sub: '30 dias antes do fim do contrato' },
  plan_order: { label: 'Plano 90 dias', sub: 'Pix confirmado e plano pronto para revisão' },
} as const;

export type NotifyEvent = keyof typeof NOTIFY_EVENTS;

export interface NotifyPrefs {
  events: Record<NotifyEvent, { push: boolean; bell: boolean }>;
  /** Sem push nesse intervalo (o aviso continua indo para o sino). Horário de Brasília. */
  quiet: { enabled: boolean; start: string; end: string };
}

export function defaultPrefs(): NotifyPrefs {
  const events = {} as NotifyPrefs['events'];
  for (const k of Object.keys(NOTIFY_EVENTS) as NotifyEvent[]) events[k] = { push: true, bell: true };
  return { events, quiet: { enabled: false, start: '22:00', end: '08:00' } };
}
