import PDFDocument = require('pdfkit');
import { InstagramDiagnosis } from '@prisma/client';
import { DiagnosisContent, DUA_WHATSAPP, bookingUrl, planOffer, scoreLabel } from './diagnosis.service';

const INK = '#0A0A0A';
const LIME = '#B5FB3D';
const GRAY = '#525252';
const SOFT = '#F4F4F2';
const LINE = '#E5E5E5';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 44; // margem lateral
const CW = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 64; // abaixo disso só o rodapé

/** Logo da Dua (mesmo desenho do favicon.svg). */
export function logo(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  doc.save().translate(x, y).scale(size / 936);
  doc.rect(0, 0, 936, 936).fill(LIME);
  doc.translate(75, 160).path('M0 0H786V616H569V255H565V244A378 372 0 0 1 187 616H0V364H208A138 136 0 0 0 346 228V223H0Z').fill('#000');
  doc.restore();
}

/** Helvetica do PDF só tem Latin-1: tira emojis e símbolos que virariam lixo. */
export function clean(s: unknown) {
  return String(s ?? '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ \t]+([.,!?;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();
}

const num = (n: number) => n.toLocaleString('pt-BR');

/** PDF "Análise de Perfil" para o cliente: mesmo conteúdo da página pública /diagnostico/[token]. */
export function renderDiagnosisPdf(d: InstagramDiagnosis): Promise<Buffer> {
  const c = d.content as unknown as DiagnosisContent;
  const handle = clean(d.instagramHandle);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: M, bottom: 0, left: M, right: M },
    bufferPages: true,
    info: { Title: `Análise de Perfil @${handle}`, Author: 'Dua Criativa' },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (b: Buffer) => chunks.push(b));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const need = (h: number) => {
    if (doc.y + h > BOTTOM) {
      doc.addPage();
      doc.y = M;
    }
  };

  // ── Topo ──────────────────────────────────────────────────────────────
  const headerH = 218;
  doc.rect(0, 0, PAGE_W, headerH).fill(INK);
  logo(doc, M, 34, 26);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF').text('Dua Criativa', M + 36, 41, { lineBreak: false });

  doc.roundedRect(M, 86, 118, 18, 9).fill(LIME);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text('ANÁLISE GRATUITA', M, 91.5, { width: 118, align: 'center', characterSpacing: 0.8 });

  const titleW = CW - 140;
  doc.font('Helvetica-Bold').fontSize(28).fillColor('#FFFFFF').text('Análise de Perfil', M, 116, { width: titleW });
  doc.font('Helvetica-Bold').fontSize(20).fillColor(LIME).text(`@${handle}`, M, 150, { width: titleW, lineBreak: false, ellipsis: true });
  const date = d.createdAt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  doc.font('Helvetica').fontSize(9.5).fillColor('#A3A3A3').text(`Análise feita em ${date}`, M, 182);

  if (d.score !== null) {
    const r = 46;
    const cx = PAGE_W - M - r - 6;
    const cy = 112;
    doc.lineWidth(9).circle(cx, cy, r).stroke('#2A2A2A');
    const frac = Math.max(0.001, Math.min(0.999, d.score / 100));
    const a = -Math.PI / 2 + frac * 2 * Math.PI;
    doc.lineWidth(9).lineCap('round')
      .path(`M ${cx} ${cy - r} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`)
      .stroke(LIME);
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#FFFFFF').text(String(d.score), cx - r, cy - 17, { width: r * 2, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor('#A3A3A3').text('de 100', cx - r, cy + 13, { width: r * 2, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(LIME).text(scoreLabel(d.score), cx - 70, cy + r + 14, { width: 140, align: 'center' });
  }

  doc.y = headerH + 24;

  // ── O que a nota significa ────────────────────────────────────────────
  if (d.score !== null) {
    const explain = clean(c.nota_explicacao) ||
      'A nota vai de 0 a 100 e resume conteúdo, constância, engajamento e clareza do perfil para quem chega pela primeira vez.';
    doc.font('Helvetica').fontSize(10);
    const h = doc.heightOfString(explain, { width: CW - 32 }) + 40;
    const y = doc.y;
    doc.roundedRect(M, y, CW, h, 10).fill(SOFT);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('O que a nota significa', M + 16, y + 14);
    doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(explain, M + 16, y + 29, { width: CW - 32, lineGap: 1.5 });
    doc.y = y + h + 16;
  }

  // ── Números do perfil ─────────────────────────────────────────────────
  const mt = c.metricas;
  if (mt) {
    const cards = [
      mt.seguidores !== null ? { v: num(mt.seguidores), l: 'seguidores' } : null,
      mt.engajamento ? { v: mt.engajamento.replace('.', ','), l: 'engajamento médio por post' } : null,
      mt.posts !== null ? { v: num(mt.posts), l: 'posts publicados' } : null,
    ].filter(Boolean) as { v: string; l: string }[];
    if (cards.length) {
      need(70);
      const gap = 10;
      const w = (CW - gap * (cards.length - 1)) / cards.length;
      const y = doc.y;
      cards.forEach((card, i) => {
        const x = M + i * (w + gap);
        doc.roundedRect(x, y, w, 58, 10).lineWidth(1).stroke(LINE);
        doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text(card.v, x + 14, y + 12, { width: w - 28, lineBreak: false });
        doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(card.l, x + 14, y + 36, { width: w - 28, lineBreak: false });
      });
      doc.y = y + 58 + 10;
    }
    if (mt.melhorPost) {
      const b = mt.melhorPost;
      const quando = b.data ? ` de ${b.data.split('-').reverse().slice(0, 2).join('/')}` : '';
      const line = `Post com mais interações nos últimos 12: ${b.formato}${quando}, com ${num(b.curtidas)} curtidas e ${num(b.comentarios)} comentários.`;
      const legenda = clean(b.legenda) ? `"${clean(b.legenda).replace(/\s+/g, ' ').slice(0, 110)}${b.legenda.length > 110 ? '...' : ''}"` : '';
      need(40);
      doc.font('Helvetica').fontSize(9.5).fillColor(GRAY).text(line, M, doc.y, { width: CW });
      if (legenda) doc.font('Helvetica-Oblique').fontSize(9).fillColor('#737373').text(legenda, { width: CW });
      doc.y += 18;
    }
  }

  // ── Resumo ────────────────────────────────────────────────────────────
  const resumo = clean(c.resumo);
  doc.font('Helvetica').fontSize(12.5);
  need(doc.heightOfString(resumo, { width: CW, lineGap: 3 }) + 20);
  doc.fillColor(INK).text(resumo, M, doc.y, { width: CW, lineGap: 3 });
  doc.moveDown(1.4);

  // ── Listas ────────────────────────────────────────────────────────────
  const section = (title: string, items: string[], dot: string) => {
    if (!items.length) return;
    need(60);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(title, M, doc.y);
    doc.moveDown(0.5);
    for (const raw of items) {
      const item = clean(raw);
      doc.font('Helvetica').fontSize(10.5);
      const h = doc.heightOfString(item, { width: CW - 18, lineGap: 2 });
      need(h + 8);
      const y = doc.y;
      doc.circle(M + 4, y + 6, 3.5).fill(dot);
      if (dot === LIME) doc.circle(M + 4, y + 6, 3.5).lineWidth(0.6).stroke(INK);
      doc.font('Helvetica').fontSize(10.5).fillColor('#333333').text(item, M + 18, y, { width: CW - 18, lineGap: 2 });
      doc.y += 6;
    }
    doc.moveDown(1);
  };
  section('O que já funciona bem', c.pontos_fortes ?? [], LIME);
  section('Possíveis pontos de melhoria', c.oportunidades ?? [], INK);

  // ── Próximos passos ───────────────────────────────────────────────────
  need(90);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text('Próximos passos', M, doc.y);
  doc.font('Helvetica').fontSize(9.5).fillColor(GRAY).text('Dá para começar ainda esta semana, em ordem de impacto.');
  doc.moveDown(0.8);
  (c.proximos_passos ?? []).forEach((p, i) => {
    const titulo = clean(p.titulo);
    const desc = clean(p.descricao);
    doc.font('Helvetica').fontSize(10);
    const h = Math.max(30, 16 + doc.heightOfString(desc, { width: CW - 42, lineGap: 1.5 }));
    need(h + 10);
    const y = doc.y;
    doc.circle(M + 13, y + 12, 13).fill(INK);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(LIME).text(String(i + 1), M, y + 6, { width: 26, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(titulo, M + 42, y + 1, { width: CW - 42 });
    doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(desc, M + 42, doc.y + 2, { width: CW - 42, lineGap: 1.5 });
    doc.y = Math.max(doc.y, y + h) + 10;
  });
  doc.moveDown(0.8);

  // ── Oferta do plano pago (destaque principal) ─────────────────────────
  const plan = planOffer(d.token);
  {
    need(176);
    const y = doc.y;
    const h = 160;
    doc.roundedRect(M, y, CW, h, 14).fill(LIME);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('QUER O PASSO A PASSO PRONTO?', M + 22, y + 20, { characterSpacing: 0.8 });
    doc.font('Helvetica-Bold').fontSize(19).fillColor(INK).text(clean(plan.name), M + 22, y + 36, { width: CW - 44 });
    doc.font('Helvetica').fontSize(10.5).fillColor('#1F1F1F').text(plan.pitch, M + 22, y + 64, { width: CW - 44, lineGap: 1.5 });
    doc.roundedRect(M + 22, y + 106, 170, 32, 16).fill(INK);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(LIME).text('Quero meu plano', M + 22, y + 116.5, { width: 170, align: 'center' });
    doc.link(M + 22, y + 106, 170, 32, plan.url);
    doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(plan.priceLabel, M + 210, y + 104, { width: CW - 232, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('#1F1F1F')
      .text(`no Pix, entregue em até ${plan.deliveryHours}h`, M + 210, y + 123, { width: CW - 232, lineBreak: false });
    doc.y = y + h + 14;
  }

  // ── Conversa com especialista ─────────────────────────────────────────
  const link = bookingUrl();
  need(100);
  const y = doc.y;
  const ctaH = 92;
  doc.roundedRect(M, y, CW, ctaH, 14).fill(INK);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF').text('Prefere conversar antes?', M + 22, y + 18, { width: CW - 44 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#D4D4D4')
    .text('Agende uma conversa gratuita com um especialista da Dua.', M + 22, y + 37, { width: CW - 44 });
  doc.roundedRect(M + 22, y + 54, 150, 24, 12).lineWidth(1).stroke(LIME);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(LIME).text('Agendar conversa', M + 22, y + 61, { width: 150, align: 'center' });
  doc.link(M + 22, y + 54, 150, 24, link);
  doc.font('Helvetica').fontSize(8.5).fillColor('#A3A3A3')
    .text(link.replace(/^https?:\/\//, ''), M + 186, y + 56, { width: CW - 208, link, lineBreak: false })
    .text(`WhatsApp ${DUA_WHATSAPP}  ·  Instagram @duacriativa`, M + 186, y + 69, { width: CW - 208, lineBreak: false });
  doc.y = y + ctaH;

  // ── Rodapé em todas as páginas ────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.font('Helvetica').fontSize(8).fillColor('#A3A3A3')
      .text(`Dua Criativa · Marketing para marcas de moda · Análise de Perfil @${handle}`, M, PAGE_H - 36, { width: CW - 40, lineBreak: false })
      .text(`${i + 1}/${range.count}`, PAGE_W - M - 40, PAGE_H - 36, { width: 40, align: 'right', lineBreak: false });
  }

  doc.end();
  return done;
}
