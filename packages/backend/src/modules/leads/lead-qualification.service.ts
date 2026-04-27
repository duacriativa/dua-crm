import { Injectable, Logger } from '@nestjs/common';

export interface LeadFormData {
  name: string;
  phone?: string;
  email?: string;
  instagram?: string;
  monthlyRevenue?: string;  // "Menos de R$ 50k/mês" | "R$ 50k – R$ 100k/mês" | "R$ 100k – R$ 150k/mês" | "Acima de R$ 150k/mês"
  saleModel?: string;       // "Loja física" | "Online" | "Loja física + online" | "Atacado"
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface QualificationResult {
  score: number;
  qualification: 'ULTRA' | 'QUALIFIED' | 'COLD' | 'UNQUALIFIED';
  reasons: string[];
}

@Injectable()
export class LeadQualificationService {
  private readonly logger = new Logger(LeadQualificationService.name);

  qualify(data: LeadFormData): QualificationResult {
    let score = 0;
    const reasons: string[] = [];

    // ── Faturamento mensal ──────────────────────────────
    const revenue = (data.monthlyRevenue ?? '').toLowerCase();

    if (revenue.includes('150k') || revenue.includes('acima')) {
      score += 4;
      reasons.push('Faturamento acima de R$150k/mês');
    } else if (revenue.includes('100k')) {
      score += 3;
      reasons.push('Faturamento entre R$100k–R$150k/mês');
    } else if (revenue.includes('50k')) {
      score += 2;
      reasons.push('Faturamento entre R$50k–R$100k/mês');
    } else if (revenue.includes('menos')) {
      score += 0;
      reasons.push('Faturamento abaixo de R$50k/mês');
    }

    // ── Modelo de venda ────────────────────────────────
    const model = (data.saleModel ?? '').toLowerCase();

    if (model.includes('físic') && model.includes('online')) {
      score += 2;
      reasons.push('Loja física + online (estrutura completa)');
    } else if (model.includes('online')) {
      score += 1;
      reasons.push('Venda online');
    } else if (model.includes('atacado')) {
      score += 1;
      reasons.push('Atacado');
    }

    // ── Resultado ──────────────────────────────────────
    let qualification: QualificationResult['qualification'];

    if (score >= 5) {
      qualification = 'ULTRA';
    } else if (score >= 2) {
      qualification = 'QUALIFIED';
    } else if (score >= 1) {
      qualification = 'COLD';
    } else {
      qualification = 'COLD';
    }

    this.logger.log(
      `Lead qualificado: ${data.name} → ${qualification} (score: ${score}) | ${reasons.join(', ')}`,
    );

    return { score, qualification, reasons };
  }
}
