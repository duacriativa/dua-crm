import PDFDocument = require('pdfkit');
import { PlanOrder } from '@prisma/client';
import { clean, logo } from '../contacts/diagnosis-pdf';
import { DUA_WHATSAPP, bookingUrl } from '../contacts/diagnosis.service';
import { PlanContent } from './plan-generator';

const INK = '#0A0A0A';
const LIME = '#B5FB3D';
const LIME_SOFT = '#EEFDD5';
const TEXT = '#262626';
const MUTED = '#6B6B6B';
const SOFT = '#F5F5F2';
const LINE = '#E4E4E0';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 48;
const CW = PAGE_W - M * 2;
const TOP = 58; // páginas de continuação: abaixo do cabeçalho corrido
const BOTTOM = PAGE_H - 62;

const SECTIONS: [string, string][] = [
  ['Metas e primeira semana', 'Onde você quer chegar em 90 dias e por onde começar'],
  ['Estratégia e posicionamento', 'Quem a marca é, com quem fala e como fala'],
  ['Pilares de conteúdo', 'Os assuntos que sustentam tudo o que você posta'],
  ['Calendário de 12 semanas', 'O que postar, semana a semana'],
  ['Roteiros de Reels', 'Roteiros prontos para gravar, cena a cena'],
  ['Legendas prontas', 'Textos para copiar, adaptar e publicar'],
  ['Ideias de stories', 'Para manter os stories vivos todos os dias'],
  ['O que contratar', 'Quem e o que vale trazer para o time'],
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Quebra textos longos em parágrafos de 2 a 3 frases: mais respiro para ler. */
function paragraphs(raw: string, max = 330) {
  const out: string[] = [];
  for (const block of clean(raw).split(/\n\s*\n/)) {
    let cur = '';
    for (const s of block.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"'“])/)) {
      if (cur && cur.length + s.length > max) {
        out.push(cur);
        cur = s;
      } else cur = cur ? `${cur} ${s}` : s;
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** Cor da etiqueta de formato: Reels em lime, carrossel em preto, o resto em cinza. */
function formatStyle(f: string) {
  const k = f.toLowerCase();
  if (k.includes('reel') || k.includes('vídeo') || k.includes('video')) return { bg: LIME, fg: INK };
  if (k.includes('carross')) return { bg: INK, fg: '#FFFFFF' };
  return { bg: '#E7E7E3', fg: INK };
}

/** PDF do plano de 3 meses com a identidade da Dua (mesmo visual do PDF do diagnóstico). */
export function renderPlanPdf(o: PlanOrder): Promise<Buffer> {
  const p = (o.plan ?? {}) as unknown as PlanContent;
  const handle = clean(o.instagramHandle);
  const product = clean(o.productName);
  const doc = new PDFDocument({
    size: 'A4',
    // Margem de baixo real: textos longos quebram de página sozinhos sem invadir o rodapé
    margins: { top: TOP, bottom: PAGE_H - BOTTOM, left: M, right: M },
    bufferPages: true,
    info: { Title: `${product} @${handle}`, Author: 'Dua Criativa' },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (b: Buffer) => chunks.push(b));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // Cabeçalho corrido de cada página (null = capa ou abertura de seção, que já têm o título grande)
  const heads: (string | null)[] = [null];
  let head: string | null = null;
  doc.on('pageAdded', () => heads.push(head));

  const newPage = () => {
    doc.addPage();
    doc.y = TOP;
  };
  const need = (h: number) => {
    if (doc.y + h > BOTTOM) newPage();
  };
  const measure = (text: string, size: number, width: number, font = 'Helvetica', lineGap = 3) => {
    if (!text) return 0;
    doc.font(font).fontSize(size);
    return doc.heightOfString(text, { width, lineGap });
  };
  /** Escreve um texto em (x, y) e devolve a altura ocupada. */
  const put = (text: string, x: number, y: number, width: number, o2: { size?: number; font?: string; color?: string; gap?: number; align?: 'left' | 'right' | 'center'; spacing?: number } = {}) => {
    if (!text) return 0;
    doc.font(o2.font ?? 'Helvetica').fontSize(o2.size ?? 10.5).fillColor(o2.color ?? TEXT)
      .text(text, x, y, { width, lineGap: o2.gap ?? 3, align: o2.align, characterSpacing: o2.spacing });
    return doc.y - y;
  };
  const pill = (text: string, x: number, y: number, bg: string, fg: string, size = 7.5) => {
    const t = text.toUpperCase();
    doc.font('Helvetica-Bold').fontSize(size);
    const w = doc.widthOfString(t, { characterSpacing: 0.6 }) + 14;
    doc.roundedRect(x, y, w, size + 8, (size + 8) / 2).fill(bg);
    doc.fillColor(fg).text(t, x, y + 4.2, { width: w, align: 'center', characterSpacing: 0.6, lineBreak: false });
    return w;
  };
  const eyebrow = (text: string, x = M, y = doc.y, color = MUTED) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(color).text(text.toUpperCase(), x, y, { characterSpacing: 1, lineBreak: false });
    return 12;
  };
  /** Título de bloco dentro da seção: quadradinho lime + título. */
  const heading = (text: string, sub?: string) => {
    const subH = sub ? measure(sub, 10, CW) + 4 : 0;
    need(70 + subH);
    const y = doc.y;
    doc.roundedRect(M, y + 3, 10, 10, 2).fill(LIME);
    put(text, M + 18, y, CW - 18, { size: 14, font: 'Helvetica-Bold', color: INK });
    doc.y = y + 22;
    if (sub) doc.y += put(sub, M, doc.y, CW, { size: 10, color: MUTED }) + 4;
    doc.y += 8;
  };
  /** Parágrafos corridos (podem quebrar de página). */
  const prose = (raw: string, size = 10.5, x = M, width = CW) => {
    for (const t of paragraphs(raw)) {
      const h = measure(t, size, width);
      if (h < 140) need(h + 4);
      doc.font('Helvetica').fontSize(size).fillColor(TEXT).text(t, x, doc.y, { width, lineGap: 3.2 });
      doc.y += 7;
    }
  };
  const sectionPage = (n: number) => {
    head = null;
    doc.addPage();
    head = `${pad2(n)}  ${SECTIONS[n - 1][0]}`;
    doc.rect(0, 0, PAGE_W, 128).fill(INK);
    logo(doc, M, 30, 16);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#8A8A8A')
      .text(`SEÇÃO ${pad2(n)} DE ${pad2(SECTIONS.length)}`, M + 26, 34.5, { characterSpacing: 1, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(40).fillColor(LIME).text(pad2(n), M, 62, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#FFFFFF').text(SECTIONS[n - 1][0], M + 66, 64, { width: CW - 66, lineBreak: false });
    doc.font('Helvetica').fontSize(10.5).fillColor('#A3A3A3').text(SECTIONS[n - 1][1], M + 66, 93, { width: CW - 66, lineBreak: false });
    doc.y = 128 + 30;
  };

  const weeks = p.calendario ?? [];
  const metas = p.metas ?? [];
  const totalPosts = weeks.reduce((s, w) => s + (w.feed?.length ?? 0), 0);

  // ── Capa ──────────────────────────────────────────────────────────────
  doc.page.margins.bottom = 0;
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(INK);
  doc.font('Helvetica-Bold').fontSize(330).fillColor('#151515').text('90', 250, 70, { lineBreak: false });
  logo(doc, M, 48, 28);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF').text('Dua Criativa', M + 38, 56, { lineBreak: false });
  pill('Plano personalizado', M, 196, LIME, INK, 8);
  doc.font('Helvetica-Bold').fontSize(38).fillColor('#FFFFFF').text(product, M, 226, { width: CW - 40, lineGap: 0 });
  doc.font('Helvetica-Bold').fontSize(22).fillColor(LIME).text(`@${handle}`, M, doc.y + 12, { width: CW });
  const date = (o.reviewedAt ?? o.generatedAt ?? new Date()).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  doc.font('Helvetica').fontSize(10.5).fillColor('#A3A3A3').text(`Preparado para ${clean(o.name)} em ${date}`, M, doc.y + 10);

  // Números do plano
  const stats = [
    [String(weeks.length || 12), 'semanas'],
    [String(totalPosts), 'posts no feed'],
    [String(p.reels?.length ?? 0), 'roteiros de Reels'],
    [String(p.legendas?.length ?? 0), 'legendas prontas'],
  ].filter(([n]) => n !== '0');
  let y = 470;
  doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.6).stroke('#2A2A2A');
  const sw = CW / Math.max(1, stats.length);
  stats.forEach(([n, l], i) => {
    doc.font('Helvetica-Bold').fontSize(30).fillColor(LIME).text(n, M + i * sw, y + 20, { lineBreak: false });
    doc.font('Helvetica').fontSize(9.5).fillColor('#A3A3A3').text(l, M + i * sw, y + 56, { width: sw - 10, lineBreak: false });
  });
  y += 84;
  doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(0.6).stroke('#2A2A2A');

  // Índice em duas colunas
  y += 26;
  eyebrow('O que tem aqui', M, y, '#8A8A8A');
  y += 24;
  const half = Math.ceil(SECTIONS.length / 2);
  SECTIONS.forEach(([s], i) => {
    const cx = M + (i < half ? 0 : CW / 2);
    const cy = y + (i % half) * 24;
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(LIME).text(pad2(i + 1), cx, cy, { lineBreak: false });
    doc.font('Helvetica').fontSize(10.5).fillColor('#FFFFFF').text(s, cx + 26, cy, { lineBreak: false });
  });
  doc.font('Helvetica').fontSize(8.5).fillColor('#737373')
    .text('Plano feito pela equipe da Dua Criativa a partir do seu Instagram e das suas respostas.', M, PAGE_H - 62, { width: CW });

  // ── Visão geral (uma página) ──────────────────────────────────────────
  head = null;
  doc.addPage();
  head = 'Visão geral';
  doc.rect(0, 0, PAGE_W, 6).fill(LIME);
  eyebrow('Seu plano em uma página', M, 40);
  doc.font('Helvetica-Bold').fontSize(26).fillColor(INK).text('Visão geral', M, 56);
  doc.y = 100;
  const e = p.estrategia;
  if (e && clean(e.resumo)) {
    const [lead, ...rest] = paragraphs(e.resumo, 300);
    doc.y += put(lead, M, doc.y, CW, { size: 13, color: INK, gap: 3.5 }) + 8;
    for (const t of rest) doc.y += put(t, M, doc.y, CW, { size: 10, color: MUTED, gap: 3 }) + 6;
    doc.y += 14;
  }

  // Os 3 meses lado a lado, com os temas das semanas
  if (metas.length) {
    need(200);
    doc.y += eyebrow('Seus 90 dias') + 6;
    const gap = 10;
    const colW = (CW - gap * (metas.length - 1)) / metas.length;
    const top = doc.y;
    const per = Math.ceil(weeks.length / metas.length) || 4;
    const headH = Math.max(...metas.map((m) => measure(clean(m.foco), 11, colW - 24, 'Helvetica-Bold', 2))) + 40;
    const rowsH = metas.map((_, i) => weeks.slice(i * per, i * per + per)
      .reduce((s, w) => s + measure(clean(w.tema), 9, colW - 48, 'Helvetica', 1.5) + 9, 0));
    const colH = headH + Math.max(0, ...rowsH) + 12;
    metas.forEach((m, i) => {
      const x = M + i * (colW + gap);
      doc.roundedRect(x, top, colW, colH, 10).fill(SOFT);
      doc.roundedRect(x, top, colW, headH, 10).fill(INK);
      doc.rect(x, top + headH - 10, colW, 10).fill(INK);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(LIME).text(`MÊS ${m.mes}`, x + 12, top + 13, { characterSpacing: 1, lineBreak: false });
      put(clean(m.foco), x + 12, top + 28, colW - 24, { size: 11, font: 'Helvetica-Bold', color: '#FFFFFF', gap: 2 });
      let ry = top + headH + 10;
      for (const w of weeks.slice(i * per, i * per + per)) {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(`S${pad2(w.semana)}`, x + 12, ry + 1, { lineBreak: false });
        ry += put(clean(w.tema), x + 36, ry, colW - 48, { size: 9, color: INK, gap: 1.5 }) + 9;
      }
    });
    doc.y = top + colH + 22;
  }

  // Mix de pilares numa barra só
  const pilares = (p.pilares ?? []).map((x) => ({ ...x, pct: Math.max(0, Math.min(100, Number(x.percentual) || 0)) }));
  const mixColors = [LIME, INK, '#8C8C8C', '#D6D6D2', '#4A4A4A', LIME_SOFT];
  const mixBar = (x: number, y0: number, w: number) => {
    const total = pilares.reduce((s, x2) => s + x2.pct, 0) || 1;
    let bx = x;
    doc.save().roundedRect(x, y0, w, 22, 6).clip();
    pilares.forEach((pl, i) => {
      const segW = (w * pl.pct) / total;
      const c = mixColors[i % mixColors.length];
      doc.rect(bx, y0, segW, 22).fill(c);
      if (segW > 30) {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(c === INK || c === '#4A4A4A' || c === '#8C8C8C' ? '#FFFFFF' : INK)
          .text(`${pl.pct}%`, bx, y0 + 7, { width: segW, align: 'center', lineBreak: false });
      }
      bx += segW;
    });
    doc.restore();
    // Legenda em duas colunas
    let ly = y0 + 34;
    pilares.forEach((pl, i) => {
      const lx = x + (i % 2) * (w / 2);
      if (i % 2 === 0 && i > 0) ly += 18;
      doc.roundedRect(lx, ly + 1, 9, 9, 2).fill(mixColors[i % mixColors.length]);
      if (mixColors[i % mixColors.length] === LIME_SOFT || mixColors[i % mixColors.length] === '#D6D6D2') doc.roundedRect(lx, ly + 1, 9, 9, 2).lineWidth(0.5).stroke('#BDBDB8');
      doc.font('Helvetica').fontSize(9.5).fillColor(TEXT).text(clean(pl.nome), lx + 15, ly, { width: w / 2 - 20, lineBreak: false, ellipsis: true });
    });
    return ly + 18 - y0;
  };
  if (pilares.length) {
    need(90);
    doc.y += eyebrow('Mix de conteúdo') + 8;
    doc.y += mixBar(M, doc.y, CW) + 16;
  }

  const freqBox = () => {
    const text = clean(e?.frequencia);
    if (!text) return;
    const h = measure(text, 10, CW - 130) + 28;
    need(h + 8);
    const by = doc.y;
    doc.save().roundedRect(M, by, CW, h, 10).clip();
    doc.rect(M, by, CW, h).fill(LIME_SOFT);
    doc.rect(M, by, 4, h).fill(LIME);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text('FREQUÊNCIA', M + 18, by + 15, { characterSpacing: 1, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('de postagem', M + 18, by + 27, { lineBreak: false });
    put(text, M + 112, by + 14, CW - 130, { size: 10, color: TEXT });
    doc.y = by + h + 12;
  };
  freqBox();

  // ── 1. Metas e primeira semana ────────────────────────────────────────
  sectionPage(1);
  for (const m of metas) {
    const items = (m.metas ?? []).map(clean).filter(Boolean);
    const rw = CW - 108;
    const foco = clean(m.foco);
    const h = 30 + measure(foco, 14, rw, 'Helvetica-Bold', 2) + items.reduce((s, t) => s + measure(t, 10.5, rw - 22) + 8, 0) + 14;
    need(h + 14);
    const by = doc.y;
    doc.roundedRect(M, by, CW, h, 12).lineWidth(1).stroke(LINE);
    doc.roundedRect(M, by, 84, h, 12).fill(INK);
    doc.rect(M + 72, by, 12, h).fill(INK);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#A3A3A3').text('MÊS', M, by + 22, { width: 84, align: 'center', characterSpacing: 1 });
    doc.font('Helvetica-Bold').fontSize(40).fillColor(LIME).text(String(m.mes), M, by + 34, { width: 84, align: 'center' });
    let ry = by + 18;
    ry += put(foco, M + 104, ry, rw, { size: 14, font: 'Helvetica-Bold', color: INK, gap: 2 }) + 10;
    for (const t of items) {
      doc.circle(M + 109, ry + 6.5, 4.5).lineWidth(1.4).stroke(INK);
      doc.circle(M + 109, ry + 6.5, 1.6).fill(LIME);
      ry += put(t, M + 126, ry, rw - 22, { size: 10.5 }) + 8;
    }
    doc.y = by + h + 14;
  }
  if (p.primeiros_passos?.length) {
    doc.y += 14;
    heading('Checklist da primeira semana', 'Faça nesta ordem. Marque cada item quando concluir.');
    p.primeiros_passos.map(clean).filter(Boolean).forEach((t, i) => {
      const h = measure(t, 10.5, CW - 74) + 20;
      need(h + 6);
      const ry = doc.y;
      doc.roundedRect(M, ry, CW, h, 8).fill(SOFT);
      doc.roundedRect(M + 14, ry + h / 2 - 7, 14, 14, 3).lineWidth(1.3).stroke(INK);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(pad2(i + 1), M + 36, ry + 11, { lineBreak: false });
      put(t, M + 58, ry + 10, CW - 74, { size: 10.5 });
      doc.y = ry + h + 6;
    });
  }

  // ── 2. Estratégia ─────────────────────────────────────────────────────
  sectionPage(2);
  if (e) {
    const block = (title: string, text: string) => {
      if (!clean(text)) return;
      heading(title);
      prose(text);
      doc.y += 14;
    };
    block('Onde a marca está hoje', e.diagnostico);
    block('Posicionamento', e.posicionamento);
    block('Com quem você fala', e.publico);
    const difs = (e.diferenciais ?? []).map(clean).filter(Boolean);
    if (difs.length) {
      heading('Diferenciais para comunicar');
      for (const t of difs) {
        const h = measure(t, 10.5, CW - 50) + 20;
        need(h + 6);
        const ry = doc.y;
        doc.roundedRect(M, ry, CW, h, 8).lineWidth(1).stroke(LINE);
        doc.circle(M + 18, ry + h / 2, 7).fill(LIME);
        doc.moveTo(M + 14.5, ry + h / 2).lineTo(M + 17.2, ry + h / 2 + 2.8).lineTo(M + 21.8, ry + h / 2 - 2.6).lineWidth(1.4).stroke(INK);
        put(t, M + 36, ry + 10, CW - 50, { size: 10.5 });
        doc.y = ry + h + 6;
      }
      doc.y += 16;
    }
    if (clean(e.tom_de_voz)) {
      heading('Tom de voz');
      const parts = paragraphs(e.tom_de_voz);
      const h = parts.reduce((s, t) => s + measure(t, 10.5, CW - 40) + 7, 0) + 26;
      if (h < BOTTOM - TOP) {
        need(h + 8);
        const by = doc.y;
        doc.save().roundedRect(M, by, CW, h, 10).clip();
        doc.rect(M, by, CW, h).fill(SOFT);
        doc.rect(M, by, 4, h).fill(INK);
        doc.restore();
        let ry = by + 14;
        for (const t of parts) ry += put(t, M + 22, ry, CW - 40, { size: 10.5 }) + 7;
        doc.y = by + h + 16;
      } else prose(e.tom_de_voz);
    }
    freqBox();
  }

  // ── 3. Pilares ────────────────────────────────────────────────────────
  sectionPage(3);
  if (pilares.length) {
    doc.y += mixBar(M, doc.y, CW) + 26;
  }
  // Exemplo "Carrossel: 5 erros..." vira etiqueta de formato + texto
  const splitFormat = (raw: string) => {
    const t = clean(raw);
    const m = t.match(/^(Reels?|Carrossel|Foto|Post|Stories|Story|Vídeo|Live|Estático)\s*:\s*(.+)$/i);
    return m ? { fmt: m[1], text: m[2] } : { fmt: '', text: t };
  };
  {
    const gap = 12;
    const colW = (CW - gap) / 2;
    const inner = colW - 32;
    const cardH = (pl: (typeof pilares)[number]) =>
      54 + measure(clean(pl.nome), 13, inner - 60, 'Helvetica-Bold', 2) + measure(clean(pl.objetivo), 10, inner) + 14
      + (pl.exemplos ?? []).map(splitFormat).reduce((s, x) => s + (x.fmt ? 17 : 0) + measure(x.text, 9.5, inner) + 10, 0);
    for (let i = 0; i < pilares.length; i += 2) {
      const row = pilares.slice(i, i + 2);
      const h = Math.max(...row.map(cardH));
      need(h + 12);
      const ry = doc.y;
      row.forEach((pl, k) => {
        const x = M + k * (colW + gap);
        doc.roundedRect(x, ry, colW, h, 12).lineWidth(1).stroke(LINE);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(`PILAR ${pad2(i + k + 1)}`, x + 16, ry + 16, { characterSpacing: 1, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(`${pl.pct}%`, x + colW - 86, ry + 12, { width: 70, align: 'right', lineBreak: false });
        doc.roundedRect(x + colW - 56, ry + 38, 40, 4, 2).fill(SOFT);
        doc.roundedRect(x + colW - 56, ry + 38, Math.max(4, (40 * pl.pct) / 100), 4, 2).fill(LIME);
        let cy = ry + 32;
        cy += put(clean(pl.nome), x + 16, cy, inner - 60, { size: 13, font: 'Helvetica-Bold', color: INK, gap: 2 }) + 6;
        cy += put(clean(pl.objetivo), x + 16, cy, inner, { size: 10, color: MUTED }) + 8;
        doc.moveTo(x + 16, cy).lineTo(x + colW - 16, cy).lineWidth(0.6).stroke(LINE);
        cy += 10;
        for (const ex of (pl.exemplos ?? []).map(splitFormat)) {
          if (!ex.text) continue;
          if (ex.fmt) {
            const st = formatStyle(ex.fmt);
            pill(ex.fmt, x + 16, cy, st.bg, st.fg, 7);
            cy += 17;
          }
          cy += put(ex.text, x + 16, cy, inner, { size: 9.5, color: INK }) + 10;
        }
      });
      doc.y = ry + h + 12;
    }
  }

  // ── 4. Calendário ─────────────────────────────────────────────────────
  // Abertura: as 12 semanas numa grade (semana × dia); depois uma semana por página
  sectionPage(4);
  doc.y += put('A grade abaixo mostra o trimestre inteiro de relance. Nas páginas seguintes, cada semana tem a sua: os posts do feed com dia, formato e ideia, e os stories logo abaixo.', M, doc.y, CW, { size: 10.5, color: MUTED }) + 20;
  const perMonth = Math.ceil(weeks.length / Math.max(1, metas.length)) || 4;
  const monthOf = (wi: number) => (metas.length ? metas[Math.min(metas.length - 1, Math.floor(wi / perMonth))] : undefined);
  const dayKey = (d: string) => clean(d).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(0, 3);
  const DAY_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const dayRank = (k: string) => (DAY_ORDER.includes(k) ? DAY_ORDER.indexOf(k) : 99);
  const dayNames = new Map<string, string>();
  for (const w of weeks) for (const f of w.feed ?? []) if (clean(f.dia) && !dayNames.has(dayKey(f.dia))) dayNames.set(dayKey(f.dia), clean(f.dia));
  const days = [...dayNames.keys()].sort((a, b) => dayRank(a) - dayRank(b));
  if (days.length && days.length <= 5) {
    const semW = 50;
    const temaW = days.length <= 3 ? 190 : 150;
    const dW = (CW - semW - temaW) / days.length;
    const RH = 38;
    const gridHead = () => {
      const hy = doc.y;
      eyebrow('Sem.', M, hy);
      eyebrow('Tema', M + semW, hy);
      days.forEach((d, i) => eyebrow(dayNames.get(d)!, M + semW + temaW + i * dW, hy));
      doc.y = hy + 18;
      doc.moveTo(M, doc.y).lineTo(M + CW, doc.y).lineWidth(1).stroke(INK);
    };
    gridHead();
    weeks.forEach((w, wi) => {
      const month = monthOf(wi);
      if (month && wi % perMonth === 0) {
        if (doc.y + 26 + RH > BOTTOM) {
          newPage();
          gridHead();
        }
        const my = doc.y + 6;
        doc.roundedRect(M, my, CW, 20, 4).fill(SOFT);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(INK)
          .text(`MÊS ${month.mes}  ·  ${clean(month.foco)}`, M + 8, my + 6.5, { width: CW - 16, characterSpacing: 0.6, lineBreak: false, ellipsis: true });
        doc.y = my + 20;
      }
      if (doc.y + RH > BOTTOM) {
        newPage();
        gridHead();
      }
      const ry = doc.y;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(pad2(w.semana), M, ry + 12, { lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(INK).text(clean(w.tema), M + semW, ry + 8, { width: temaW - 14, height: 24, lineGap: 1.5, ellipsis: true });
      days.forEach((d, i) => {
        const posts = (w.feed ?? []).filter((f) => dayKey(f.dia) === d);
        if (!posts.length) return;
        const x = M + semW + temaW + i * dW;
        const fmt = clean(posts[0].formato) || 'Post';
        const st = formatStyle(fmt);
        const pw = pill(fmt, x, ry + 7, st.bg, st.fg, 7);
        if (posts.length > 1) doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED).text(`+${posts.length - 1}`, x + pw + 4, ry + 10.5, { lineBreak: false });
        doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(clean(posts[0].pilar), x, ry + 25, { width: dW - 8, height: 9, ellipsis: true });
      });
      doc.moveTo(M, ry + RH).lineTo(M + CW, ry + RH).lineWidth(0.5).stroke(LINE);
      doc.y = ry + RH;
    });
  }

  weeks.forEach((w, wi) => {
    newPage();
    const month = monthOf(wi);
    const tema = clean(w.tema);
    const obj = clean(w.objetivo);
    const tx = M + 100;
    const tw = CW - 100 - 22;
    const hh = Math.max(104, 20 + (month ? 16 : 0) + measure(tema, 17, tw, 'Helvetica-Bold', 2) + (obj ? 8 + measure(obj, 9.5, tw, 'Helvetica', 2.5) : 0) + 20);
    const hy = doc.y;
    doc.roundedRect(M, hy, CW, hh, 14).fill(INK);
    eyebrow('Semana', M + 22, hy + 22, '#8A8A8A');
    doc.font('Helvetica-Bold').fontSize(46).fillColor(LIME).text(pad2(w.semana), M + 20, hy + 36, { lineBreak: false });
    let ty = hy + 20;
    if (month) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(LIME)
        .text(`MÊS ${month.mes}  ·  ${clean(month.foco).toUpperCase()}`, tx, ty + 2, { width: tw, characterSpacing: 0.8, lineBreak: false, ellipsis: true });
      ty += 16;
    }
    ty += put(tema, tx, ty, tw, { size: 17, font: 'Helvetica-Bold', color: '#FFFFFF', gap: 2 }) + 8;
    if (obj) put(obj, tx, ty, tw, { size: 9.5, color: '#B5B5B5', gap: 2.5 });
    doc.y = hy + hh + 24;

    // Posts do feed: dia, formato e pilar à esquerda; ideia à direita
    const feed = w.feed ?? [];
    if (feed.length) doc.y += eyebrow(`Feed  ·  ${feed.length} ${feed.length === 1 ? 'post' : 'posts'}`) + 8;
    const lw = 116;
    const iw = CW - lw - 40;
    for (const post of feed) {
      const ideia = clean(post.ideia);
      const pilar = clean(post.pilar);
      const h = Math.max(measure(ideia, 10.5, iw, 'Helvetica', 3) + 30, 56 + measure(pilar, 8.5, lw - 18, 'Helvetica', 1.5) + 14);
      need(h + 10);
      const py = doc.y;
      doc.roundedRect(M, py, CW, h, 10).fill(SOFT);
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(clean(post.dia).toUpperCase(), M + 16, py + 16, { width: lw - 18, characterSpacing: 0.8, lineBreak: false });
      const fmt = clean(post.formato);
      if (fmt) {
        const st = formatStyle(fmt);
        pill(fmt, M + 16, py + 33, st.bg, st.fg, 7);
      }
      put(pilar, M + 16, py + 56, lw - 18, { size: 8.5, color: MUTED, gap: 1.5 });
      doc.moveTo(M + lw + 6, py + 14).lineTo(M + lw + 6, py + h - 14).lineWidth(0.8).stroke('#DCDCD6');
      put(ideia, M + lw + 24, py + 15, iw, { size: 10.5, color: INK, gap: 3 });
      doc.y = py + h + 8;
    }

    const stories = (w.stories ?? []).map(clean).filter(Boolean);
    if (stories.length) {
      doc.y += 16;
      need(70);
      doc.y += eyebrow(`Stories da semana  ·  ${stories.length} ideias`) + 10;
      stories.forEach((t, n) => {
        const h = measure(t, 10, CW - 34, 'Helvetica', 2.8);
        need(h + 10);
        const sy = doc.y;
        doc.circle(M + 9, sy + 6, 8).fill(n === 0 ? LIME : SOFT);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INK).text(String(n + 1), M + 1, sy + 3, { width: 16, align: 'center', lineBreak: false });
        put(t, M + 28, sy, CW - 34, { size: 10, color: TEXT, gap: 2.8 });
        doc.y = sy + Math.max(h, 14) + 10;
      });
    }
  });

  // ── 5. Reels ──────────────────────────────────────────────────────────
  // "Pilar Aula para marcas: gerar salvamentos..." vira etiqueta do pilar + objetivo
  const splitPilar = (raw: string) => {
    const t = clean(raw);
    const m = t.match(/^Pilar\s+([^:]{2,60}):\s*(.+)$/i);
    if (!m) return { pilar: '', text: t };
    return { pilar: m[1], text: m[2].charAt(0).toUpperCase() + m[2].slice(1) };
  };
  sectionPage(5);
  const reels = p.reels ?? [];
  doc.y += put('Cada roteiro começa numa página nova: gancho, cenas com o que mostrar e o que falar, e no fim o texto na tela, o CTA e o áudio.', M, doc.y, CW, { size: 10.5, color: MUTED }) + 18;
  reels.forEach((r, i) => {
    const t = clean(r.titulo);
    const { pilar } = splitPilar(r.objetivo);
    const h = measure(t, 11.5, CW - 50, 'Helvetica-Bold', 2) + (pilar ? 16 : 0) + 24;
    need(h);
    const ry = doc.y;
    doc.roundedRect(M, ry + 11, 28, 22, 6).fill(INK);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(LIME).text(pad2(i + 1), M, ry + 17.5, { width: 28, align: 'center', lineBreak: false });
    const th = put(t, M + 42, ry + 12, CW - 50, { size: 11.5, font: 'Helvetica-Bold', color: INK, gap: 2 });
    if (pilar) put(pilar, M + 42, ry + 16 + th, CW - 50, { size: 8.5, color: MUTED });
    doc.moveTo(M, ry + h).lineTo(M + CW, ry + h).lineWidth(0.5).stroke(LINE);
    doc.y = ry + h;
  });
  reels.forEach((r, i) => {
    newPage();
    const ty = doc.y;
    doc.roundedRect(M, ty, 34, 34, 8).fill(INK);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(LIME).text(pad2(i + 1), M, ty + 11, { width: 34, align: 'center', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED).text(`ROTEIRO ${pad2(i + 1)} DE ${pad2(reels.length)}`, M + 48, ty + 1, { characterSpacing: 1, lineBreak: false });
    doc.y = ty + 13 + put(clean(r.titulo), M + 48, ty + 13, CW - 48, { size: 15, font: 'Helvetica-Bold', color: INK, gap: 2 });
    const { pilar, text: objetivo } = splitPilar(r.objetivo);
    doc.y = Math.max(doc.y, ty + 34) + 8;
    if (pilar) {
      pill(pilar, M + 48, doc.y, LIME_SOFT, INK, 7);
      doc.y += 19;
    }
    if (objetivo) doc.y += put(objetivo, M + 48, doc.y, CW - 48, { size: 9.5, color: MUTED }) + 14;

    const gancho = clean(r.gancho);
    if (gancho) {
      const h = measure(gancho, 11, CW - 36, 'Helvetica-Bold') + 38;
      need(h + 10);
      const gy = doc.y;
      doc.roundedRect(M, gy, CW, h, 10).fill(INK);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(LIME).text('GANCHO  ·  2 PRIMEIROS SEGUNDOS', M + 18, gy + 13, { characterSpacing: 1, lineBreak: false });
      put(gancho, M + 18, gy + 27, CW - 36, { size: 11, font: 'Helvetica-Bold', color: '#FFFFFF' });
      doc.y = gy + h + 16;
    }

    // Roteiro em linha do tempo: ação em cinza, fala em destaque
    const cenas = (r.roteiro ?? []).map(clean).filter(Boolean);
    if (cenas.length) {
      need(60);
      doc.y += eyebrow('Cena a cena') + 6;
    }
    cenas.forEach((raw, k) => {
      const t = raw.replace(/^Cena\s*\d+\s*[:.-]\s*/i, '');
      const [acao, ...fala] = t.split(/\s*Fala:\s*/i);
      const falaTxt = fala.join(' ').trim();
      const tw = CW - 34;
      const h = measure(acao, 9.5, tw, 'Helvetica', 2.5) + (falaTxt ? measure(`Fala: ${falaTxt}`, 10.5, tw, 'Helvetica-Bold', 2.5) + 4 : 0);
      need(h + 12);
      const cy = doc.y;
      if (k < cenas.length - 1) doc.moveTo(M + 10, cy + 20).lineTo(M + 10, cy + h + 14).lineWidth(1).stroke(LINE);
      doc.circle(M + 10, cy + 8, 10).fill(k === 0 ? LIME : SOFT);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text(String(k + 1), M, cy + 4.5, { width: 20, align: 'center', lineBreak: false });
      let ty2 = cy + 2;
      if (acao) ty2 += put(acao, M + 34, ty2, tw, { size: 9.5, color: MUTED, gap: 2.5 }) + 4;
      if (falaTxt) {
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Fala: ', M + 34, ty2, { width: tw, lineGap: 2.5, continued: true })
          .font('Helvetica').text(falaTxt);
        ty2 = doc.y;
      }
      doc.y = Math.max(ty2, cy + 20) + 10;
    });

    // Rodapé do roteiro: texto na tela, CTA e áudio lado a lado
    const info = [
      ['Texto na tela', clean(r.texto_na_tela)],
      ['CTA', clean(r.cta)],
      ['Áudio', clean(r.audio)],
    ].filter(([, v]) => v);
    if (info.length) {
      const gap = 8;
      const iw = (CW - gap * (info.length - 1)) / info.length;
      const h = Math.max(...info.map(([, v]) => measure(v, 9, iw - 24, 'Helvetica', 2))) + 38;
      need(h + 10);
      const iy = doc.y + 4;
      info.forEach(([k, v], n) => {
        const x = M + n * (iw + gap);
        doc.roundedRect(x, iy, iw, h, 8).fill(k === 'CTA' ? LIME_SOFT : SOFT);
        eyebrow(k, x + 12, iy + 12, k === 'CTA' ? INK : MUTED);
        put(v, x + 12, iy + 28, iw - 24, { size: 9, color: INK, gap: 2 });
      });
      doc.y = iy + h + 18;
    }
  });

  // ── 6. Legendas ───────────────────────────────────────────────────────
  sectionPage(6);
  (p.legendas ?? []).forEach((l, i) => {
    const text = clean(l.legenda);
    const tags = clean(l.hashtags);
    const tema = clean(l.tema);
    const inner = CW - 44;
    const temaH = measure(tema, 12, inner - 90, 'Helvetica-Bold', 2);
    const h = 30 + Math.max(16, temaH) + 10 + measure(text, 10, inner) + (tags ? measure(tags, 8.5, inner, 'Helvetica', 2) + 12 : 0) + 18;
    const fits = h < BOTTOM - TOP - 10;
    need(fits ? h + 14 : 140);
    const ly = doc.y;
    if (fits) {
      doc.roundedRect(M, ly, CW, h, 12).lineWidth(1).stroke(LINE);
      doc.roundedRect(M, ly, 5, h, 2.5).fill(LIME);
    }
    pill(`Legenda ${pad2(i + 1)}`, M + 22, ly + 18, INK, LIME, 7);
    const th = put(tema, M + 22 + 90, ly + 17, inner - 90, { size: 12, font: 'Helvetica-Bold', color: INK, gap: 2 });
    doc.font('Helvetica').fontSize(10).fillColor(TEXT).text(text, M + 22, ly + 18 + Math.max(16, th) + 12, { width: inner, lineGap: 3 });
    if (tags) {
      doc.y += 10;
      doc.font('Helvetica').fontSize(8.5).fillColor('#7A7A7A').text(tags, M + 22, doc.y, { width: inner, lineGap: 2 });
    }
    doc.y = (fits ? ly + h : doc.y + 10) + 14;
  });

  // ── 7. Stories ────────────────────────────────────────────────────────
  sectionPage(7);
  {
    const cats = (p.stories ?? []).map((s) => ({ nome: clean(s.categoria), ideias: (s.ideias ?? []).map(clean).filter(Boolean) }));
    const gap = 12;
    const colW = (CW - gap) / 2;
    const inner = colW - 32;
    const cardH = (c: (typeof cats)[number]) => 46 + measure(c.nome, 13, inner, 'Helvetica-Bold', 2)
      + c.ideias.reduce((s, t) => s + measure(t, 9.5, inner - 20, 'Helvetica', 2.5) + 9, 0) + 8;
    for (let i = 0; i < cats.length; i += 2) {
      const row = cats.slice(i, i + 2);
      const h = Math.max(...row.map(cardH));
      need(h + 12);
      const ry = doc.y;
      row.forEach((c, k) => {
        const x = M + k * (colW + gap);
        doc.roundedRect(x, ry, colW, h, 12).fill(SOFT);
        eyebrow(`${c.ideias.length} ideias`, x + 16, ry + 16);
        let cy = ry + 30;
        cy += put(c.nome, x + 16, cy, inner, { size: 13, font: 'Helvetica-Bold', color: INK, gap: 2 }) + 12;
        c.ideias.forEach((t, n) => {
          doc.circle(x + 23, cy + 6, 7).fill(n === 0 ? LIME : '#FFFFFF');
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INK).text(String(n + 1), x + 16, cy + 3, { width: 14, align: 'center', lineBreak: false });
          cy += put(t, x + 36, cy, inner - 20, { size: 9.5, color: INK, gap: 2.5 }) + 9;
        });
      });
      doc.y = ry + h + 12;
    }
  }

  // ── 8. O que contratar ────────────────────────────────────────────────
  sectionPage(8);
  for (const c of p.contratar ?? []) {
    const why = clean(c.por_que);
    const item = clean(c.item);
    const inv = clean(c.investimento);
    const quando = clean(c.quando);
    const leftW = CW - 32 - 150;
    const cat = clean(c.categoria);
    // "Outro" não diz nada: sem etiqueta, o título sobe
    const hasTag = cat && cat.toLowerCase() !== 'outro';
    const h = Math.max(110, (hasTag ? 44 : 20) + measure(item, 12, leftW, 'Helvetica-Bold', 2) + 6 + measure(why, 9.8, leftW) + 16);
    need(h + 10);
    const cy = doc.y;
    doc.roundedRect(M, cy, CW, h, 12).lineWidth(1).stroke(LINE);
    // Coluna da direita: investimento e quando
    doc.roundedRect(M + CW - 150, cy, 150, h, 12).fill(SOFT);
    doc.rect(M + CW - 150, cy, 12, h).fill(SOFT);
    eyebrow('Investimento', M + CW - 136, cy + 16);
    const ih = put(inv || 'A combinar', M + CW - 136, cy + 30, 122, { size: 11, font: 'Helvetica-Bold', color: INK, gap: 2 });
    if (quando) {
      eyebrow('Quando', M + CW - 136, cy + 30 + ih + 10);
      put(quando, M + CW - 136, cy + 30 + ih + 23, 122, { size: 9.5, color: TEXT, gap: 1.5 });
    }
    // Coluna da esquerda
    if (hasTag) pill(cat, M + 16, cy + 16, LIME, INK, 7);
    let ty = cy + (hasTag ? 40 : 16);
    ty += put(item, M + 16, ty, leftW, { size: 12, font: 'Helvetica-Bold', color: INK, gap: 2 }) + 6;
    put(why, M + 16, ty, leftW, { size: 9.8, color: MUTED });
    doc.y = cy + h + 10;
  }

  // ── CTA ───────────────────────────────────────────────────────────────
  const link = bookingUrl();
  doc.y += 20;
  need(170);
  const cy = doc.y;
  doc.roundedRect(M, cy, CW, 150, 16).fill(INK);
  logo(doc, M + 24, cy + 24, 20);
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#FFFFFF').text('Quer que a Dua execute com você?', M + 24, cy + 54, { width: CW - 48 });
  doc.font('Helvetica').fontSize(10).fillColor('#D4D4D4')
    .text('Produção de conteúdo, fotos, Reels e tráfego pago para marcas de moda. Agende uma conversa e a gente mostra como acelerar este plano.', M + 24, cy + 78, { width: CW - 48, lineGap: 1.5 });
  doc.roundedRect(M + 24, cy + 108, 150, 28, 14).fill(LIME);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Agendar conversa', M + 24, cy + 117, { width: 150, align: 'center', link });
  doc.font('Helvetica').fontSize(8.5).fillColor('#A3A3A3')
    .text(link.replace(/^https?:\/\//, ''), M + 188, cy + 112, { width: CW - 212, link, lineBreak: false })
    .text(`WhatsApp ${DUA_WHATSAPP}  ·  Instagram @duacriativa`, M + 188, cy + 125, { width: CW - 212, lineBreak: false });
  doc.link(M + 24, cy + 108, 150, 28, link);

  // ── Cabeçalho corrido e rodapé (menos na capa) ────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    doc.page.margins.top = 0;
    const h2 = heads[i];
    if (h2) {
      doc.roundedRect(M, 27, 7, 7, 1.5).fill(LIME);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#9A9A9A').text(h2.toUpperCase(), M + 13, 27.5, { characterSpacing: 0.8, lineBreak: false });
    }
    doc.moveTo(M, PAGE_H - 44).lineTo(M + CW, PAGE_H - 44).lineWidth(0.5).stroke(LINE);
    doc.font('Helvetica').fontSize(8).fillColor('#A3A3A3')
      .text(`Dua Criativa  ·  ${product}  ·  @${handle}`, M, PAGE_H - 33, { width: CW - 40, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK)
      .text(`${pad2(i + 1)} / ${pad2(range.count)}`, PAGE_W - M - 60, PAGE_H - 33, { width: 60, align: 'right', lineBreak: false });
  }

  doc.end();
  return done;
}
