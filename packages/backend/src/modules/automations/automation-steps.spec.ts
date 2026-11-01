// Teste do "pular as perguntas e mandar o link": `npm run test:bots`
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { bookingLinkStep, wantsBookingLink } from './automation-steps';

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
