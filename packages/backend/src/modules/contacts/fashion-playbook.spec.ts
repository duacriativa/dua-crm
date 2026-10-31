// Teste do playbook de moda da análise do Instagram: `npm run test:playbook`
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { detectNiche, easter, profileSignals, seasonalCalendar } from './fashion-playbook';
import { giftsFromAnalysis } from './diagnosis-gifts';

// Sábado, 31/10/2026, 10h em Brasília
const NOW = new Date('2026-10-31T13:00:00Z');

test('nicho: bio pesa mais que legendas e "feminina" só vence sem nicho específico', () => {
  const fitness = detectNiche({
    nome: 'Movimenta Fit', bio: 'Moda fitness feminina 🏋️ Leggings que não ficam transparentes',
    ultimos_posts: [{ legenda: 'Novo biquíni chegando para o verão' }, { legenda: 'Top fitness + legging' }],
  });
  assert.equal(fitness.principal.id, 'fitness');

  const geral = detectNiche({ nome: 'Loja da Ana', bio: 'Moda feminina | Envio para todo o Brasil' });
  assert.equal(geral.principal.id, 'feminina');

  const vazio = detectNiche({ nome: 'abc', bio: '' });
  assert.equal(vazio.principal.id, 'feminina');
  assert.equal(vazio.certeza, 'baixa');

  const infantil = detectNiche({ bio: 'Roupas infantis para meninas de 1 a 12 anos 🎀', ultimos_posts: [{ legenda: 'Vestido infantil de festa' }] });
  assert.equal(infantil.principal.id, 'infantil');
});

test('sinais: formatos, constância, CTA e bio', () => {
  const s = profileSignals({
    bio: 'Moda praia 👙 Chama no WhatsApp 👇 Enviamos para todo o Brasil',
    site: 'https://loja.com',
    ultimos_posts: [
      { data: '2026-10-29', formato: 'REELS', curtidas: 300, comentarios: 20, legenda: 'Biquíni novo! Link na bio, tamanhos P ao GG' },
      { data: '2026-10-22', formato: 'CAROUSEL_ALBUM', curtidas: 100, comentarios: 10, legenda: 'Qual a sua cor favorita?' },
      { data: '2026-10-15', formato: 'IMAGE', curtidas: 50, comentarios: 2, legenda: 'Por R$ 129,90' },
    ],
  }, NOW);
  assert.equal(s.posts_analisados, 3);
  assert.deepEqual(s.formatos, { Reels: 1, Carrossel: 1, Foto: 1 });
  assert.equal(s.formato_que_mais_engaja, 'Reels');
  assert.equal(s.posts_por_semana, 1); // 3 posts em 14 dias
  assert.equal(s.dias_desde_ultimo_post, 2);
  assert.equal(s.legendas_com_chamada_de_compra, '1 de 3');
  assert.equal(s.legendas_com_preco_ou_oferta, '1 de 3');
  assert.equal(s.legendas_com_tamanho, '1 de 3');
  assert.equal(s.legendas_com_pergunta, '1 de 3');
  assert.equal(s.bio.tem_link, true);
  assert.equal(s.bio.menciona_whatsapp, true);
  assert.equal(s.bio.menciona_entrega_ou_envio, true);
  assert.equal(s.bio.tem_chamada_para_acao, true);
});

test('sinais: perfil sem posts não quebra', () => {
  const s = profileSignals({ bio: '' }, NOW);
  assert.equal(s.posts_analisados, 0);
  assert.equal(s.posts_por_semana, null);
  assert.equal(s.dias_desde_ultimo_post, null);
  assert.equal(s.formato_que_mais_engaja, null);
});

test('calendário: datas móveis', () => {
  assert.equal(easter(2026).toISOString().slice(0, 10), '2026-04-05');
  assert.equal(easter(2027).toISOString().slice(0, 10), '2027-03-28');
});

test('calendário: próximos 75 dias a partir de 31/10/2026, filtrando por nicho', () => {
  const praia = seasonalCalendar(['praia'], NOW);
  assert.deepEqual(praia.map((x) => `${x.data} ${x.ocasiao}`), [
    '2026-11-27 Black Friday',
    '2026-12-25 Natal',
    '2026-12-31 Réveillon',
    '2027-01-10 Liquidação de verão',
  ]);
  assert.equal(praia.find((x) => x.ocasiao === 'Réveillon')?.gancho, 'look de virada na praia');

  const infantil = seasonalCalendar(['infantil'], NOW);
  assert.ok(!infantil.some((x) => x.ocasiao === 'Réveillon'));
  assert.ok(infantil.some((x) => x.ocasiao === 'Natal' && x.gancho === 'look de Natal em família'));

  // Dia das Crianças já passou: não entra
  assert.ok(!infantil.some((x) => x.ocasiao === 'Dia das Crianças'));
});

test('presentes do diagnóstico: só campos válidos, nada da análise interna', () => {
  const g = giftsFromAnalysis({
    alertas: ['interno'],
    bio: { sugestao: 'Biquínis que abraçam o seu corpo\nEnvio para todo o Brasil' },
    ideias_carrossel: [{ titulo: 'Como escolher o biquíni certo', slides: ['a', 'b', 'Chama no WhatsApp'] }, { titulo: '', slides: ['x'] }],
    stories: { caixinhas: ['Asa delta ou fio?', 42] },
    calendario: [{ data: '2026-11-27', ocasiao: 'Black Friday', ideia: 'Lista VIP' }, { data: 'novembro', ocasiao: 'x', ideia: 'y' }],
  })!;
  assert.equal(g.ideias_carrossel.length, 1);
  assert.deepEqual(g.caixinhas, ['Asa delta ou fio?']);
  assert.equal(g.datas.length, 1);
  assert.ok(!JSON.stringify(g).includes('interno'));
  assert.equal(giftsFromAnalysis({ score: 50 }), undefined);
});
