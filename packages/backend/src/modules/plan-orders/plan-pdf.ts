import PDFDocument = require('pdfkit');
import { PlanOrder } from '@prisma/client';
import { clean, logo } from '../contacts/diagnosis-pdf';
import { DUA_WHATSAPP, bookingUrl } from '../contacts/diagnosis.service';
import { PlanContent } from './plan-generator';

const INK = '#0A0A0A';
const LIME = '#B5FB3D';
const GRAY = '#525252';
const SOFT = '#F4F4F2';
const LINE = '#E5E5E5';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 44;
const CW = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 64;

const SECTIONS = [
  'Estratégia e posicionamento',
  'Pilares de conteúdo',
  'Calendário de 12 semanas',
  'Roteiros de Reels',
  'Legendas prontas',
  'Ideias de stories',
  'O que contratar',
  'Metas de 90 dias',
];

/** PDF do plano de 3 meses com a identidade da Dua (mesmo visual do PDF do diagnóstico). */
export function renderPlanPdf(o: PlanOrder): Promise<Buffer> {
  const p = (o.plan ?? {}) as unknown as PlanContent;
  const handle = clean(o.instagramHandle);
  const product = clean(o.productName);
  const doc = new PDFDocument({
    size: 'A4',
    // Margem de baixo real: textos longos (legendas, roteiros) quebram de página sozinhos sem invadir o rodapé
    margins: { top: M, bottom: 64, left: M, right: M },
    bufferPages: true,
    info: { Title: `${product} @${handle}`, Author: 'Dua Criativa' },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (b: Buffer) => chunks.push(b));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  let pageNo = 0;
  doc.on('pageAdded', () => { pageNo++; });
  const need = (h: number) => {
    if (doc.y + h > BOTTOM) {
      doc.addPage();
      doc.y = M;
    }
  };
  const height = (text: string, size: number, width = CW, font = 'Helvetica', lineGap = 2) => {
    doc.font(font).fontSize(size);
    return doc.heightOfString(text, { width, lineGap });
  };
  const para = (raw: string, opts: { size?: number; color?: string; x?: number; width?: number; font?: string } = {}) => {
    const text = clean(raw);
    if (!text) return;
    const size = opts.size ?? 10.5;
    const width = opts.width ?? CW;
    const x = opts.x ?? M;
    const font = opts.font ?? 'Helvetica';
    // Parágrafo longo pode quebrar de página sozinho; curto vai inteiro para a próxima
    const h = height(text, size, width, font);
    if (h < 160) need(h + 4);
    doc.font(font).fontSize(size).fillColor(opts.color ?? '#333333').text(text, x, doc.y, { width, lineGap: 2 });
  };
  const label = (text: string) => {
    need(40);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text(text.toUpperCase(), M, doc.y, { characterSpacing: 0.8 });
    doc.moveDown(0.3);
  };
  const bullets = (items: string[], x = M, width = CW, dot = LIME) => {
    for (const raw of items) {
      const item = clean(raw);
      if (!item) continue;
      const h = height(item, 10.5, width - 18);
      need(h + 6);
      const y = doc.y;
      doc.circle(x + 4, y + 6, 3.2).fill(dot);
      if (dot === LIME) doc.circle(x + 4, y + 6, 3.2).lineWidth(0.6).stroke(INK);
      doc.font('Helvetica').fontSize(10.5).fillColor('#333333').text(item, x + 16, y, { width: width - 16, lineGap: 2 });
      doc.y += 4;
    }
  };
  const sectionPage = (n: number) => {
    doc.addPage();
    doc.rect(0, 0, PAGE_W, 92).fill(INK);
    logo(doc, M, 30, 18);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(LIME).text(`${String(n).padStart(2, '0')} / ${String(SECTIONS.length).padStart(2, '0')}`, M + 28, 34);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF').text(SECTIONS[n - 1], M, 52, { width: CW });
    doc.y = 92 + 26;
  };

  // ── Capa ──────────────────────────────────────────────────────────────
  doc.page.margins.bottom = 0;
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(INK);
  logo(doc, M, 44, 30);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF').text('Dua Criativa', M + 40, 52, { lineBreak: false });
  doc.roundedRect(M, 200, 150, 20, 10).fill(LIME);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text('PLANO PERSONALIZADO', M, 206.5, { width: 150, align: 'center', characterSpacing: 0.8 });
  doc.font('Helvetica-Bold').fontSize(34).fillColor('#FFFFFF').text(product, M, 236, { width: CW, lineGap: 2 });
  doc.font('Helvetica-Bold').fontSize(22).fillColor(LIME).text(`@${handle}`, M, doc.y + 8, { width: CW });
  const date = (o.reviewedAt ?? o.generatedAt ?? new Date()).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  doc.font('Helvetica').fontSize(10.5).fillColor('#A3A3A3').text(`Preparado para ${clean(o.name)} em ${date}`, M, doc.y + 10);

  let y = 470;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#A3A3A3').text('O QUE TEM AQUI', M, y, { characterSpacing: 0.8 });
  y += 22;
  SECTIONS.forEach((s, i) => {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(LIME).text(String(i + 1).padStart(2, '0'), M, y, { width: 26 });
    doc.font('Helvetica').fontSize(11).fillColor('#FFFFFF').text(s, M + 30, y);
    y += 22;
  });
  doc.font('Helvetica').fontSize(8.5).fillColor('#737373')
    .text('Plano feito pela equipe da Dua Criativa a partir do seu Instagram e das suas respostas.', M, PAGE_H - 70, { width: CW });

  // ── 1. Estratégia ─────────────────────────────────────────────────────
  const e = p.estrategia;
  sectionPage(1);
  if (e) {
    para(e.resumo, { size: 13, color: INK });
    doc.moveDown(1.2);
    const block = (title: string, text: string) => {
      if (!clean(text)) return;
      label(title);
      para(text);
      doc.moveDown(1);
    };
    block('Onde a marca está hoje', e.diagnostico);
    block('Posicionamento', e.posicionamento);
    block('Público', e.publico);
    if (e.diferenciais?.length) {
      label('Diferenciais para comunicar');
      bullets(e.diferenciais);
      doc.moveDown(0.8);
    }
    block('Tom de voz', e.tom_de_voz);
    if (clean(e.frequencia)) {
      const text = clean(e.frequencia);
      const h = height(text, 10.5, CW - 32) + 38;
      need(h + 8);
      const by = doc.y;
      doc.roundedRect(M, by, CW, h, 10).fill(SOFT);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Frequência de postagem', M + 16, by + 13);
      doc.font('Helvetica').fontSize(10.5).fillColor(GRAY).text(text, M + 16, by + 28, { width: CW - 32, lineGap: 2 });
      doc.y = by + h + 10;
    }
  }

  // ── 2. Pilares ────────────────────────────────────────────────────────
  sectionPage(2);
  for (const pil of p.pilares ?? []) {
    const ex = (pil.exemplos ?? []).map(clean).filter(Boolean);
    const h = 58 + height(clean(pil.objetivo), 10.5, CW - 32) + ex.reduce((s, x) => s + height(x, 10, CW - 48) + 4, 0);
    need(h + 12);
    const by = doc.y;
    doc.roundedRect(M, by, CW, h, 12).lineWidth(1).stroke(LINE);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(clean(pil.nome), M + 16, by + 14, { width: CW - 120 });
    const pct = Math.max(0, Math.min(100, Number(pil.percentual) || 0));
    doc.roundedRect(PAGE_W - M - 96, by + 16, 80, 8, 4).fill(SOFT);
    doc.roundedRect(PAGE_W - M - 96, by + 16, Math.max(8, (80 * pct) / 100), 8, 4).fill(LIME);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(`${pct}%`, PAGE_W - M - 140, by + 15, { width: 38, align: 'right' });
    doc.font('Helvetica').fontSize(10.5).fillColor(GRAY).text(clean(pil.objetivo), M + 16, by + 34, { width: CW - 32, lineGap: 2 });
    doc.y += 6;
    for (const x of ex) {
      const ly = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('—', M + 16, ly);
      doc.font('Helvetica').fontSize(10).fillColor('#333333').text(x, M + 32, ly, { width: CW - 48, lineGap: 2 });
      doc.y += 4;
    }
    doc.y = by + h + 12;
  }

  // ── 3. Calendário ─────────────────────────────────────────────────────
  sectionPage(3);
  para('Uma semana por bloco. Siga a ordem: as primeiras semanas constroem base, o meio acelera alcance e o final foca em venda.', { color: GRAY, size: 10 });
  doc.moveDown(1);
  const cols = [{ w: 62, k: 'dia' }, { w: 70, k: 'formato' }, { w: 96, k: 'pilar' }, { w: CW - 62 - 70 - 96, k: 'ideia' }] as const;
  for (const w of p.calendario ?? []) {
    need(80);
    const hy = doc.y;
    doc.roundedRect(M, hy, CW, 26, 8).fill(INK);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(LIME).text(`SEMANA ${w.semana}`, M + 12, hy + 8, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#FFFFFF').text(clean(w.tema), M + 92, hy + 8, { width: CW - 104, lineBreak: false, ellipsis: true });
    doc.y = hy + 32;
    if (clean(w.objetivo)) para(`Objetivo: ${w.objetivo}`, { size: 9.5, color: GRAY });
    doc.y += 4;
    for (const post of w.feed ?? []) {
      const cells = cols.map((c) => clean((post as any)[c.k]));
      const rh = Math.max(...cells.map((t, i) => height(t, 9.5, cols[i].w - 8, i === 0 ? 'Helvetica-Bold' : 'Helvetica', 1))) + 10;
      need(rh);
      const ry = doc.y;
      let x = M;
      cells.forEach((t, i) => {
        doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(i === 3 ? '#333333' : INK)
          .text(t, x + 4, ry + 5, { width: cols[i].w - 8, lineGap: 1 });
        x += cols[i].w;
      });
      doc.moveTo(M, ry + rh).lineTo(M + CW, ry + rh).lineWidth(0.5).stroke(LINE);
      doc.y = ry + rh;
    }
    if (w.stories?.length) {
      doc.y += 6;
      need(30);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text('Stories da semana', M, doc.y);
      doc.y += 3;
      bullets(w.stories);
    }
    doc.moveDown(1.2);
  }

  // ── 4. Reels ──────────────────────────────────────────────────────────
  sectionPage(4);
  (p.reels ?? []).forEach((r, i) => {
    need(120);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(`${i + 1}. ${clean(r.titulo)}`, M, doc.y, { width: CW });
    if (clean(r.objetivo)) para(r.objetivo, { size: 9.5, color: GRAY });
    doc.y += 6;
    const gancho = clean(r.gancho);
    if (gancho) {
      const h = height(gancho, 10.5, CW - 32, 'Helvetica-Bold') + 30;
      need(h + 6);
      const gy = doc.y;
      doc.roundedRect(M, gy, CW, h, 8).fill(SOFT);
      doc.rect(M, gy, 4, h).fill(LIME);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GRAY).text('GANCHO (2 PRIMEIROS SEGUNDOS)', M + 16, gy + 9, { characterSpacing: 0.6 });
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(gancho, M + 16, gy + 22, { width: CW - 32, lineGap: 2 });
      doc.y = gy + h + 8;
    }
    (r.roteiro ?? []).forEach((cena, k) => {
      const t = clean(cena);
      const h = height(t, 10, CW - 26);
      need(h + 4);
      const cy = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(GRAY).text(`${k + 1}`, M, cy, { width: 16, align: 'right' });
      doc.font('Helvetica').fontSize(10).fillColor('#333333').text(t, M + 26, cy, { width: CW - 26, lineGap: 2 });
      doc.y += 3;
    });
    doc.y += 4;
    const meta = [
      clean(r.texto_na_tela) && `Texto na tela: ${clean(r.texto_na_tela)}`,
      clean(r.cta) && `CTA: ${clean(r.cta)}`,
      clean(r.audio) && `Áudio: ${clean(r.audio)}`,
    ].filter(Boolean) as string[];
    for (const m of meta) para(m, { size: 9.5, color: GRAY });
    doc.moveDown(1.4);
  });

  // ── 5. Legendas ───────────────────────────────────────────────────────
  sectionPage(5);
  (p.legendas ?? []).forEach((l, i) => {
    const text = clean(l.legenda);
    const tags = clean(l.hashtags);
    const h = 40 + height(text, 10, CW - 32) + (tags ? height(tags, 9, CW - 32) + 8 : 0);
    if (h < 400) need(h + 10);
    else need(80);
    const ly = doc.y;
    const startPage = pageNo;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(GRAY).text(`LEGENDA ${i + 1}`, M + 16, ly + 12, { characterSpacing: 0.6 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(clean(l.tema), M + 90, ly + 11, { width: CW - 106 });
    doc.font('Helvetica').fontSize(10).fillColor('#333333').text(text, M + 16, doc.y + 6, { width: CW - 32, lineGap: 2 });
    if (tags) doc.font('Helvetica').fontSize(9).fillColor('#737373').text(tags, M + 16, doc.y + 6, { width: CW - 32 });
    const end = doc.y + 12;
    // Moldura só quando a legenda coube numa página
    if (pageNo === startPage) {
      doc.roundedRect(M, ly, CW, end - ly, 10).lineWidth(1).stroke(LINE);
    }
    doc.y = end + 10;
  });

  // ── 6. Stories ────────────────────────────────────────────────────────
  sectionPage(6);
  for (const s of p.stories ?? []) {
    need(60);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(clean(s.categoria), M, doc.y);
    doc.moveDown(0.4);
    bullets(s.ideias ?? []);
    doc.moveDown(1);
  }

  // ── 7. O que contratar ────────────────────────────────────────────────
  sectionPage(7);
  for (const c of p.contratar ?? []) {
    const why = clean(c.por_que);
    const h = 44 + height(why, 10, CW - 32);
    need(h + 10);
    const cy = doc.y;
    doc.roundedRect(M, cy, CW, h, 10).lineWidth(1).stroke(LINE);
    const tag = clean(c.categoria).toUpperCase();
    doc.font('Helvetica-Bold').fontSize(8);
    const tw = doc.widthOfString(tag) + 14;
    doc.roundedRect(M + 16, cy + 12, tw, 15, 7.5).fill(LIME);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(tag, M + 16, cy + 16, { width: tw, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(clean(c.item), M + 24 + tw, cy + 13, { width: CW - 200 - tw });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(clean(c.investimento), PAGE_W - M - 156, cy + 13, { width: 140, align: 'right' });
    doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(clean(c.quando), PAGE_W - M - 156, cy + 27, { width: 140, align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor(GRAY).text(why, M + 16, cy + 34, { width: CW - 200, lineGap: 2 });
    doc.y = cy + Math.max(h, doc.y - cy + 10) + 10;
  }

  // ── 8. Metas ──────────────────────────────────────────────────────────
  sectionPage(8);
  for (const m of p.metas ?? []) {
    need(80);
    const my = doc.y;
    doc.circle(M + 16, my + 16, 16).fill(INK);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(LIME).text(`MÊS`, M, my + 8, { width: 32, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(LIME).text(String(m.mes), M, my + 17, { width: 32, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(clean(m.foco), M + 44, my + 9, { width: CW - 44 });
    doc.y = Math.max(doc.y, my + 34) + 4;
    bullets(m.metas ?? [], M + 44, CW - 44);
    doc.moveDown(1);
  }
  if (p.primeiros_passos?.length) {
    need(80);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text('Checklist da primeira semana', M, doc.y);
    doc.moveDown(0.5);
    for (const raw of p.primeiros_passos) {
      const t = clean(raw);
      const h = height(t, 10.5, CW - 24);
      need(h + 6);
      const cy = doc.y;
      doc.roundedRect(M, cy + 1, 11, 11, 2).lineWidth(1).stroke(INK);
      doc.font('Helvetica').fontSize(10.5).fillColor('#333333').text(t, M + 22, cy, { width: CW - 22, lineGap: 2 });
      doc.y += 5;
    }
  }

  // ── CTA ───────────────────────────────────────────────────────────────
  const link = bookingUrl();
  doc.moveDown(1.5);
  need(150);
  const cy = doc.y;
  doc.roundedRect(M, cy, CW, 132, 14).fill(INK);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#FFFFFF').text('Quer que a Dua execute com você?', M + 22, cy + 20, { width: CW - 44 });
  doc.font('Helvetica').fontSize(10).fillColor('#D4D4D4')
    .text('Produção de conteúdo, fotos, Reels e tráfego pago para marcas de moda. Agende uma conversa e a gente mostra como acelerar este plano.', M + 22, cy + 44, { width: CW - 44, lineGap: 1.5 });
  doc.roundedRect(M + 22, cy + 82, 150, 28, 14).fill(LIME);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Agendar conversa', M + 22, cy + 91, { width: 150, align: 'center', link });
  doc.font('Helvetica').fontSize(8.5).fillColor('#A3A3A3')
    .text(link.replace(/^https?:\/\//, ''), M + 186, cy + 86, { width: CW - 208, link, lineBreak: false })
    .text(`WhatsApp ${DUA_WHATSAPP}  ·  Instagram @duacriativa`, M + 186, cy + 99, { width: CW - 208, lineBreak: false });
  doc.link(M + 22, cy + 82, 150, 28, link);

  // ── Rodapé (menos na capa) ────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor('#A3A3A3')
      .text(`Dua Criativa · ${product} · @${handle}`, M, PAGE_H - 36, { width: CW - 40, lineBreak: false })
      .text(`${i + 1}/${range.count}`, PAGE_W - M - 40, PAGE_H - 36, { width: 40, align: 'right', lineBreak: false });
  }

  doc.end();
  return done;
}
