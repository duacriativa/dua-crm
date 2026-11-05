// Teste do "pular as perguntas e mandar o link": `npm run test:bots`
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { bookingLinkStep, sanitizeSteps, waitReplyTarget, wantsBookingLink } from './automation-steps';

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
