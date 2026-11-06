// Teste do "pular as perguntas e mandar o link": `npm run test:bots`
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { STEP_TYPES, bookingLinkStep, declinedReply, extractInstagramHandle, dueReminder, sanitizeSteps, waitPlan, waitReplyTarget, wantsBookingLink } from './automation-steps';

test('entende pedido do link', () => {
  for (const t of [
    'Pode me mandar o link', 'manda o link pfv', 'quero pular as perguntas', 'pula', 'prefiro agendar direto',
    'Quero agendar', 'vamos marcar uma reunião', 'quero escolher um horário', 'LINK',
  ]) assert.equal(wantsBookingLink(t), true, t);
});

test('não confunde resposta normal com pedido do link', () => {
  for (const t of [
    'Já estou vendendo', 'Estou começando', 'Instagram', 'pelo instagram e indicação, não investimos em tráfego',
    'a marca já está pronta', 'não temos horário fixo pra isso', 'não quero o link agora', 'sim', 'Ainda vou definir',
  ]) assert.equal(wantsBookingLink(t), false, t);
});

test('entende a recusa do lembrete', () => {
  for (const t of [
    'Agora não', 'agora nao', 'AGORA NÃO!', 'Agora não, obrigada', 'não', 'Não.', 'não, obrigada', 'Não obrigado',
    'não quero', 'Não tenho interesse', 'não tenho mais interesse', 'sem interesse', 'não é o momento', 'pare de me mandar mensagem',
  ]) assert.equal(declinedReply(t), true, t);
});

test('não confunde resposta normal com recusa', () => {
  for (const t of [
    'Já estou vendendo', 'Estou começando', 'sim', 'Quero sim', 'oi, tudo bem?', 'não sei', 'ainda não', 'ainda não vendo',
    'não vendo ainda', 'não entendi', 'tenho interesse sim', 'agora sim', '', '[documento]',
  ]) assert.equal(declinedReply(t), false, t);
});

test('acha o passo do link depois da pergunta atual', () => {
  const steps = [
    { type: 'send_text', text: 'pergunta' },
    { type: 'wait_reply' },
    { type: 'wait' },
    { type: 'send_text', text: 'Escolhe aqui: https://crm.duacriativa.com.br/agendar/especialista' },
  ];
  assert.equal(bookingLinkStep(steps, 1), 3);
  assert.equal(bookingLinkStep(steps, 3), -1);
  assert.equal(bookingLinkStep([{ type: 'send_text', text: 'sem link' }], -1), -1);
});

test('bloco próprio "pediu_link" tem preferência, mesmo no fim da lista', () => {
  const steps = [
    { type: 'wait_reply' },
    { id: 'convite', type: 'send_text', text: 'https://x/agendar/especialista' },
    { type: 'end' },
    { id: 'pediu_link', type: 'add_tag' },
    { type: 'send_text', text: 'https://x/agendar/especialista' },
  ];
  assert.equal(bookingLinkStep(steps, 0), 3);
});

test('botão de template desvia pelo caminho dele; outra resposta segue por onReply', () => {
  const step = { onReply: 'escreveu', buttons: [{ title: 'Quero o plano', goto: 'quero' }, { title: 'Agora não', goto: 'agora_nao' }] };
  assert.equal(waitReplyTarget(step, 'Quero o plano'), 'quero');
  assert.equal(waitReplyTarget(step, 'agora nao'), 'agora_nao');
  assert.equal(waitReplyTarget(step, 'não sei ainda'), 'escreveu');
  assert.equal(waitReplyTarget({ onReply: 'escreveu' }, 'Quero o plano'), 'escreveu');
});

test('salvar o bot mantém os botões da espera e o passo de pagamento', () => {
  const [espera, pagamento] = sanitizeSteps([
    { id: 'espera', type: 'wait_reply', onReply: 'fim', buttons: [{ title: 'Quero o plano', goto: 'pag' }] },
    { id: 'pag', type: 'wait_payment', timeoutSeconds: 3600, reminders: [{ afterSeconds: 60, type: 'send_text', text: 'oi' }], onPaid: 'fim', onTimeout: 'end' },
    { id: 'fim', type: 'end' },
  ]) as any[];
  assert.deepEqual(espera.buttons, [{ title: 'Quero o plano', goto: 'pag' }]);
  assert.equal(pagamento.type, 'wait_payment');
  assert.equal(pagamento.onPaid, 'fim');
  assert.equal(pagamento.reminders.length, 1);
});

test('lembrete do pagamento sai de madrugada; os outros esperam as 9h', () => {
  // Clicou às 2h de Brasília (5h UTC): 23h30 depois é 1h30 de Brasília
  const since = new Date('2026-11-05T05:00:00Z');
  const hora = new Date('2026-11-06T04:30:00Z');
  const reminders = [{ afterSeconds: 84600, type: 'send_text' as const, text: 'oi' }];
  assert.equal(dueReminder(since, 0, { reminders, anyHour: true }, hora.getTime()), 0);
  assert.equal(waitPlan(since, 0, { timeoutSeconds: 3600 }, { reminders, anyHour: true }).reminderAt?.toISOString(), hora.toISOString());
  assert.equal(dueReminder(since, 0, { reminders }, hora.getTime()), null);
  assert.equal(waitPlan(since, 0, { timeoutSeconds: 3600 }, { reminders }).reminderAt?.toISOString(), '2026-11-06T12:00:00.000Z');
});

test('lê o @ da resposta à pergunta do Instagram', () => {
  const ok: [string, string][] = [
    ['@FrancineBrand', 'francinebrand'], ['francine.brand', 'francine.brand'], ['é @francine_brand.', 'francine_brand'],
    ['https://www.instagram.com/francinebrand/?hl=pt', 'francinebrand'], ['instagram.com/marca', 'marca'], ['o nosso é @marca2 tá', 'marca2'],
  ];
  for (const [text, handle] of ok) assert.equal(extractInstagramHandle(text), handle, text);
  for (const text of ['não', 'nao', 'Não tenho', 'ainda não temos', 'sim', 'ok', 'LINK', 'Francine Brand', '[áudio]', 'eu@gmail.com', 'minhaloja.com.br', '12345', 'https://instagram.com/p/abc123', '']) {
    assert.equal(extractInstagramHandle(text), null, text);
  }
});

test('sanitizeSteps mantém o passo do Instagram', () => {
  assert.ok(STEP_TYPES.includes('check_instagram'));
  const steps = sanitizeSteps([
    { id: 'tem', type: 'check_instagram', onKnown: 'fim' },
    { id: 'espera', type: 'wait_reply', captureInstagram: true, timeoutSeconds: 3600 },
    { id: 'fim', type: 'end' },
  ]) as any[];
  assert.equal(steps[0].type, 'check_instagram');
  assert.equal(steps[0].onKnown, 'fim');
  assert.equal(steps[1].captureInstagram, true);
});
