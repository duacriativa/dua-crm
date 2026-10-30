// Teste das regras da tela Tarefas com dados de exemplo: `npm run test:rules`
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { RulesSnapshot, addBusinessMinutes, businessMinutesBetween, evaluateRules, planSync } from './sales-tasks.rules';

const H = 60 * 60 * 1000;
// Quinta, 29/10/2026, 15h em Brasília (18h UTC)
const NOW = new Date('2026-10-29T18:00:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * H);

function base(): RulesSnapshot {
  return {
    now: NOW,
    contacts: {
      ana: { id: 'ana', name: 'Ana Souza', phone: '+5511900000001', instagramHandle: 'anamoda' },
      bia: { id: 'bia', name: 'Bia Lima', phone: '+5511900000002', instagramHandle: null },
      caio: { id: 'caio', name: 'Caio', phone: '+5511900000003', instagramHandle: 'caio' },
    },
    meetings: [],
    leads: [],
    conversations: [],
    activeBotContactIds: [],
    botNotes: [],
  };
}

const kinds = (s: RulesSnapshot) => evaluateRules(s).map((t) => t.kind).sort();

test('horário comercial: conta só seg–sex 9h–18h de Brasília', () => {
  // Qui 16h → sex 10h (Brasília): 2h na quinta + 1h na sexta
  assert.equal(businessMinutesBetween(new Date('2026-10-29T19:00:00Z'), new Date('2026-10-30T13:00:00Z')), 180);
  // Sex 17h → seg 10h: 1h + 1h (fim de semana não conta)
  assert.equal(businessMinutesBetween(new Date('2026-10-30T20:00:00Z'), new Date('2026-11-02T13:00:00Z')), 120);
  // Madrugada não conta
  assert.equal(businessMinutesBetween(new Date('2026-10-29T03:00:00Z'), new Date('2026-10-29T11:00:00Z')), 0);
  // Sex 17h + 2h úteis = seg 10h
  assert.equal(addBusinessMinutes(new Date('2026-10-30T20:00:00Z'), 120).toISOString(), '2026-11-02T13:00:00.000Z');
  // Mensagem às 22h: prazo é 11h do dia seguinte
  assert.equal(addBusinessMinutes(new Date('2026-10-29T01:00:00Z'), 120).toISOString(), '2026-10-29T14:00:00.000Z');
});

test('reunião feita há mais de 24h sem o card andar → próximo passo', () => {
  const s = base();
  s.meetings = [{ id: 'm1', contactId: 'ana', status: 'COMPLETED', startAt: ago(30), endAt: ago(29), createdAt: ago(100) }];
  s.leads = [{ id: 'l1', contactId: 'ana', stageName: 'Reunião agendada', stageKind: 'OPEN', value: null, updatedAt: ago(90) }];
  const t = evaluateRules(s);
  assert.deepEqual(t.map((x) => x.ruleKey), ['meeting_next:m1']);
  assert.match(t[0].title, /Mandar proposta/);

  // O card andou depois da reunião: some
  s.leads[0].updatedAt = ago(5);
  assert.deepEqual(kinds(s), []);

  // Reunião feita há só 10h: ainda não
  s.leads[0].updatedAt = ago(90);
  s.meetings[0].endAt = ago(10);
  assert.deepEqual(kinds(s), []);
});

test('cliente: reunião de acompanhamento não vira tarefa de proposta nem de cadastro', () => {
  const s = base();
  // Card em Fechado (ganho) e nenhum aberto: o card nunca vai "andar"
  s.meetings = [{ id: 'm5', contactId: 'bia', status: 'COMPLETED', startAt: ago(30), endAt: ago(29), createdAt: ago(100) }];
  s.leads = [{ id: 'l5', contactId: 'bia', stageName: 'Fechado', stageKind: 'WON', value: 2500, updatedAt: ago(200) }];
  assert.deepEqual(kinds(s), []);

  // Marcado como cliente, mesmo sem card
  s.leads = [];
  s.contacts.bia.type = 'CLIENT';
  assert.deepEqual(kinds(s), []);

  // Mas a reunião que passou e ficou como agendada ainda pede o status
  s.meetings[0].status = 'SCHEDULED';
  s.meetings[0].endAt = ago(3);
  assert.deepEqual(kinds(s), ['MEETING_STATUS']);
});

test('reunião passou há 2h e continua agendada → marcar se aconteceu', () => {
  const s = base();
  s.leads = [{ id: 'l1', contactId: 'ana', stageName: 'Reunião agendada', stageKind: 'OPEN', value: null, updatedAt: ago(90) }];
  s.meetings = [{ id: 'm2', contactId: 'ana', status: 'SCHEDULED', startAt: ago(4), endAt: ago(3), createdAt: ago(48) }];
  assert.deepEqual(kinds(s), ['MEETING_STATUS']);
  s.meetings[0].endAt = ago(1);
  assert.deepEqual(kinds(s), []);
});

test('reunião sem card ou sem @ → completar cadastro (inclusive reunião futura)', () => {
  const s = base();
  s.meetings = [{ id: 'm3', contactId: 'bia', status: 'SCHEDULED', startAt: ago(-24), endAt: ago(-23), createdAt: ago(2) }];
  const t = evaluateRules(s);
  assert.deepEqual(t.map((x) => x.kind), ['COMPLETE_PROFILE']);
  assert.match(t[0].reason, /card no funil e @ da marca/);

  // Com card e @: some
  s.contacts.bia.instagramHandle = 'biamoda';
  s.leads = [{ id: 'l2', contactId: 'bia', stageName: 'Reunião agendada', stageKind: 'OPEN', value: null, updatedAt: ago(2) }];
  assert.deepEqual(kinds(s), []);

  // Reunião cancelada não conta
  s.leads = [];
  s.meetings[0].status = 'CANCELLED';
  assert.deepEqual(kinds(s), []);
});

test('proposta enviada há 2 dias sem mensagem do time → follow-up (valor alto no título)', () => {
  const s = base();
  s.leads = [{ id: 'l3', contactId: 'caio', stageName: 'Proposta enviada', stageKind: 'OPEN', value: 180000, updatedAt: ago(60) }];
  s.conversations = [{ id: 'c3', contactId: 'caio', status: 'OPEN', lastMessage: { id: 'x', direction: 'OUTBOUND', sentAt: ago(55) }, lastTeamOutboundAt: ago(55) }];
  const t = evaluateRules(s);
  assert.deepEqual(t.map((x) => x.kind), ['PROPOSAL_FOLLOWUP']);
  assert.match(t[0].title, /R\$\s?180\.000/);
  assert.equal(t[0].conversationId, 'c3');

  // Time mandou mensagem há 1 dia: some
  s.conversations[0].lastTeamOutboundAt = ago(24);
  assert.deepEqual(kinds(s), []);

  // Mensagem do bot não conta como do time
  s.conversations[0].lastTeamOutboundAt = ago(55);
  s.conversations[0].lastMessage = { id: 'y', direction: 'OUTBOUND', sentAt: ago(1) };
  assert.deepEqual(kinds(s), ['PROPOSAL_FOLLOWUP']);
});

test('lead escreveu por último e ninguém respondeu em 2h úteis → responder', () => {
  const s = base();
  // 12h de Brasília → 15h: 3h úteis
  s.conversations = [{ id: 'c1', contactId: 'ana', status: 'OPEN', lastMessage: { id: 'msg1', direction: 'INBOUND', sentAt: ago(3) }, lastTeamOutboundAt: ago(30) }];
  const t = evaluateRules(s);
  assert.deepEqual(t.map((x) => x.ruleKey), ['reply:c1:msg1']);
  assert.equal(t[0].title, 'Responder Ana');

  // Bot ativo: não
  s.activeBotContactIds = ['ana'];
  assert.deepEqual(kinds(s), []);
  s.activeBotContactIds = [];

  // Só 1h: não
  s.conversations[0].lastMessage!.sentAt = ago(1);
  assert.deepEqual(kinds(s), []);

  // Time respondeu: não
  s.conversations[0].lastMessage = { id: 'msg2', direction: 'OUTBOUND', sentAt: ago(0.5) };
  assert.deepEqual(kinds(s), []);

  // Conversa resolvida: não
  s.conversations[0].lastMessage = { id: 'msg3', direction: 'INBOUND', sentAt: ago(3) };
  s.conversations[0].status = 'RESOLVED';
  assert.deepEqual(kinds(s), []);
});

test('nota do bot "respondeu por mensagem em vez de agendar" → tarefa até o time responder', () => {
  const s = base();
  s.botNotes = [
    { id: 'n1', contactId: 'ana', conversationId: 'c1', content: 'Ana respondeu por mensagem em vez de agendar: "pode ser sexta?"', createdAt: ago(5) },
    { id: 'n2', contactId: 'ana', conversationId: 'c1', content: 'Ana concluiu a qualificação e recebeu o link de agendamento.', createdAt: ago(6) },
  ];
  assert.deepEqual(evaluateRules(s).map((x) => x.ruleKey), ['bot_note:n1']);

  s.conversations = [{ id: 'c1', contactId: 'ana', status: 'OPEN', lastMessage: { id: 'm', direction: 'OUTBOUND', sentAt: ago(1) }, lastTeamOutboundAt: ago(1) }];
  assert.deepEqual(kinds(s), []);

  // Ou agendou depois da nota
  s.conversations = [];
  s.meetings = [{ id: 'm9', contactId: 'ana', status: 'SCHEDULED', startAt: ago(-48), endAt: ago(-47), createdAt: ago(2) }];
  s.leads = [{ id: 'l9', contactId: 'ana', stageName: 'Reunião agendada', stageKind: 'OPEN', value: null, updatedAt: ago(2) }];
  assert.deepEqual(kinds(s), []);
});

test('sincronização: não duplica, não reabre dispensada e fecha quando a condição some', () => {
  const s = base();
  s.conversations = [{ id: 'c1', contactId: 'ana', status: 'OPEN', lastMessage: { id: 'msg1', direction: 'INBOUND', sentAt: ago(3) }, lastTeamOutboundAt: null }];
  s.meetings = [{ id: 'm2', contactId: 'caio', status: 'SCHEDULED', startAt: ago(4), endAt: ago(3), createdAt: ago(48) }];
  s.leads = [{ id: 'l1', contactId: 'caio', stageName: 'Reunião agendada', stageKind: 'OPEN', value: null, updatedAt: ago(48) }];
  const desired = evaluateRules(s);
  assert.equal(desired.length, 2);

  // 1ª rodada: cria as duas
  let plan = planSync(desired, []);
  assert.equal(plan.create.length, 2);

  // 2ª rodada: já existem → nada novo; a dispensada não volta
  const existing = [
    { id: 't1', ruleKey: 'reply:c1:msg1', status: 'DISMISSED', source: 'RULE' },
    { id: 't2', ruleKey: 'meeting_status:m2', status: 'OPEN', source: 'RULE' },
    { id: 't3', ruleKey: 'ai:2026-10-29:ana:abc', status: 'OPEN', source: 'AI' },
  ];
  plan = planSync(desired, existing);
  assert.deepEqual(plan.create, []);
  assert.deepEqual(plan.autoClose, []);

  // Marcaram a reunião como feita: a tarefa fecha sozinha; a da IA fica
  s.meetings[0].status = 'COMPLETED';
  plan = planSync(evaluateRules(s), existing);
  assert.deepEqual(plan.autoClose, ['t2']);
});
