/** "Presentes" do diagnóstico gratuito: ideias prontas tiradas da análise interna. Sem dependências (testável). */

export interface DiagnosisGifts {
  bio_sugerida: string | null;
  ideias_carrossel: { titulo: string; slides: string[] }[];
  caixinhas: string[];
  datas: { data: string; ocasiao: string; ideia: string }[];
}

export const PILAR_NOME = { desejo: 'Desejo', valor: 'Valor', direcao_compra: 'Direção de compra' } as const;

export const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const strs = (v: unknown, n: number, max: number) =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter((x): x is string => !!x).slice(0, n) : [];

/** Tira da análise interna só o que é útil e seguro para o cliente (sem alertas nem estratégia de venda). */
export function giftsFromAnalysis(a: any): DiagnosisGifts | undefined {
  const gifts: DiagnosisGifts = {
    bio_sugerida: str(a?.bio?.sugestao, 220),
    ideias_carrossel: (Array.isArray(a?.ideias_carrossel) ? a.ideias_carrossel : [])
      .map((c: any) => ({ titulo: str(c?.titulo, 120), slides: strs(c?.slides, 6, 200) }))
      .filter((c: any) => c.titulo && c.slides.length)
      .slice(0, 3),
    caixinhas: strs(a?.stories?.caixinhas, 5, 160),
    datas: (Array.isArray(a?.calendario) ? a.calendario : [])
      .map((c: any) => ({ data: str(c?.data, 10), ocasiao: str(c?.ocasiao, 60), ideia: str(c?.ideia, 240) }))
      .filter((c: any) => c.data && /^\d{4}-\d{2}-\d{2}$/.test(c.data) && c.ocasiao && c.ideia)
      .slice(0, 4),
  };
  const vazio = !gifts.bio_sugerida && !gifts.ideias_carrossel.length && !gifts.caixinhas.length && !gifts.datas.length;
  return vazio ? undefined : gifts;
}
