import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PlanAnswers, answerLines, isIsoDate, launchBrief, planStartDate, unconfirmedHandles } from './plan-brief';
import { isProfileNotFoundError } from '../contacts/instagram-errors';

const base: PlanAnswers = {
  nicho: 'Moda feminina', ticket: 'R$ 180', publico: 'Mulheres 25-40', quemPosta: 'Eu mesma(o)',
  verba: 'Até R$ 500/mês', objetivo: 'Lançar coleção', ondeVende: 'Instagram',
};
const START = '2026-11-09'; // segunda-feira

test('semana 1 começa numa segunda, depois de um dia de prazo', () => {
  // quinta 05/11 → segunda 09/11
  assert.equal(planStartDate(new Date('2026-11-05T15:00:00Z')), '2026-11-09');
  // domingo 08/11: o dia seguinte já é segunda
  assert.equal(planStartDate(new Date('2026-11-08T15:00:00Z')), '2026-11-09');
  // segunda 09/11: não dá tempo, vai para a próxima
  assert.equal(planStartDate(new Date('2026-11-09T15:00:00Z')), '2026-11-16');
  // 23h30 em Brasília de domingo ainda é domingo (UTC já é segunda)
  assert.equal(planStartDate(new Date('2026-11-09T02:30:00Z')), '2026-11-09');
});

test('lançamento com data cai em uma única semana, com aquecimento antes', () => {
  const text = launchBrief({ ...base, lancamentoStatus: 'data', lancamentoData: '2026-12-11' }, START)!;
  assert.match(text, /sexta-feira, 11\/12\/2026/);
  assert.match(text, /semana 5 do calendário/);
  assert.match(text, /Semanas 2 a 4: aquecimento/);
  assert.match(text, /Não programe nenhum outro lançamento/);
});

test('limites do calendário: primeiro dia, semana 12, antes e depois', () => {
  const at = (d: string) => launchBrief({ ...base, lancamentoStatus: 'data', lancamentoData: d }, START)!;
  assert.match(at('2026-11-09'), /semana 1 do calendário/);
  assert.doesNotMatch(at('2026-11-09'), /aquecimento/);
  assert.match(at('2027-01-31'), /semana 12 do calendário/);
  assert.doesNotMatch(at('2027-01-31'), /semana 13/);
  assert.match(at('2027-02-01'), /depois da semana 12/);
  assert.match(at('2026-11-08'), /antes de a semana 1/);
});

test('sem data ou sem lançamento: não pode aparecer lançamento marcado', () => {
  assert.match(launchBrief({ ...base, lancamentoStatus: 'sem_data' }, START)!, /Não marque o lançamento em nenhuma semana/);
  assert.match(launchBrief({ ...base, lancamentoStatus: 'nao' }, START)!, /Não crie lançamento/);
});

test('pedido antigo, sem as novas respostas, continua gerando as mesmas linhas', () => {
  const old: PlanAnswers = { ...base, referencias: '@marca1', observacoes: 'Loja no centro' };
  assert.equal(launchBrief(old, START), null);
  assert.deepEqual(answerLines(old, START), [
    '- Produto / nicho: Moda feminina',
    '- Ticket médio: R$ 180',
    '- Público: Mulheres 25-40',
    '- Quem posta hoje: Eu mesma(o)',
    '- Verba mensal para conteúdo e anúncio: Até R$ 500/mês',
    '- Objetivo principal nos próximos 3 meses: Lançar coleção (oriente o plano para isso)',
    '- Onde vende hoje: Instagram (os CTAs devem levar para esses canais)',
    '- Marcas que admira ou concorrentes: @marca1',
    '- Observações da marca: Loja no centro',
  ]);
  assert.deepEqual(unconfirmedHandles(old), []);
});

test('todas as novas respostas chegam ao prompt', () => {
  const text = answerLines({
    ...base, cidadeRegiao: 'Fortaleza', faixaPreco: 'R$ 90 a R$ 250', gradeTamanhos: 'P ao GG', pecasProntas: 'Parte pronta',
    lancamentoStatus: 'data', lancamentoData: '2026-12-11', localFotos: 'Estúdio', identidade: 'Só o logo', quemAparece: 'Equipe, Modelo',
    inspiradoras: [{ handle: 'marca.boa', confirmed: true, name: 'Marca Boa', followers: 12300 }],
    concorrentes: [{ handle: 'rival', confirmed: true }, { handle: 'lasclothing', confirmed: false, reason: 'not_found' }],
  }, START).join('\n');
  for (const piece of ['Fortaleza', 'R$ 90 a R$ 250', 'P ao GG', 'Parte pronta', 'Estúdio', 'Só o logo', 'Equipe, Modelo', 'semana 5']) {
    assert.ok(text.includes(piece), `faltou: ${piece}`);
  }
  assert.match(text, /@marca\.boa \(Marca Boa, 12\.300 seguidores\)/);
  assert.match(text, /Semana 1 do calendário começa na segunda-feira, 09\/11\/2026/);
});

test('@ não confirmado não vira referência e fica para a Dua revisar', () => {
  const a: PlanAnswers = {
    ...base,
    inspiradoras: [{ handle: 'lasclothing', confirmed: false, reason: 'not_found' }],
    concorrentes: [{ handle: 'rival', confirmed: true }, { handle: 'outra', confirmed: false, reason: 'lookup_failed' }],
  };
  const text = answerLines(a, START).join('\n');
  assert.match(text, /Marcas que inspiram: nenhum confirmado/);
  assert.match(text, /NÃO confirmados.*@lasclothing.*Não cite/);
  assert.match(text, /confirmados pela cliente no Instagram\): @rival/);
  assert.deepEqual(unconfirmedHandles(a), ['lasclothing', 'outra']);
});

test('valida data real', () => {
  assert.equal(isIsoDate('2026-12-11'), true);
  assert.equal(isIsoDate('2026-02-31'), false);
  assert.equal(isIsoDate('11/12/2026'), false);
  assert.equal(isIsoDate(undefined), false);
});

test('reconhece perfil não encontrado em qualquer idioma, sem confundir com falha da API', () => {
  // texto real da produção (05/11/2026)
  assert.equal(isProfileNotFoundError({ error_user_msg: 'Não foi possível encontrar o usuário com o nome de usuário qqxx7720dua.' }), true);
  assert.equal(isProfileNotFoundError({ message: 'Invalid user id', code: 110 }), true);
  assert.equal(isProfileNotFoundError({ message: 'Erro qualquer', error_subcode: 2207013 }), true);
  assert.equal(isProfileNotFoundError({ message: 'Application does not have permission for this action', code: 10 }), false);
  assert.equal(isProfileNotFoundError(undefined), false);
});
