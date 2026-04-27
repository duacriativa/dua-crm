import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { LeadQualificationService } from './lead-qualification.service';

export class CreatePublicLeadDto {
  @IsString()
  nome: string;

  @IsString()
  whatsapp: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  // Campos formulário novo
  @IsOptional()
  @IsString()
  faturamento_mensal?: string; // "Menos de R$ 50k/mês" | "R$ 50k – R$ 100k/mês" etc

  @IsOptional()
  @IsString()
  modelo_venda?: string; // "Loja física + online" | "Online" etc

  // Campos formulário antigo (compatibilidade)
  @IsOptional()
  @IsString()
  investimento_atual?: string;

  @IsOptional()
  @IsString()
  faturamento?: string;

  @IsOptional()
  @IsString()
  atendimento_leads?: string;

  @IsOptional()
  @IsIn(['combo', 'trafego', 'frio'])
  interesse?: 'combo' | 'trafego' | 'frio';

  @IsOptional()
  @IsString()
  origem?: string;

  // UTMs
  @IsOptional()
  @IsString()
  utm_source?: string;

  @IsOptional()
  @IsString()
  utm_medium?: string;

  @IsOptional()
  @IsString()
  utm_campaign?: string;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly qualification: LeadQualificationService,
  ) {}

  private async resolveTenantId(): Promise<string> {
    const slug = process.env.PUBLIC_LEAD_TENANT_SLUG;
    if (slug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
      if (tenant) return tenant.id;
    }
    const first = await this.prisma.tenant.findFirst({ where: { active: true } });
    if (!first) throw new InternalServerErrorException('Nenhum tenant encontrado');
    return first.id;
  }

  async createPublicLead(dto: CreatePublicLeadDto) {
    const tenantId = await this.resolveTenantId();
    const formattedPhone = WhatsAppService.formatPhone(dto.whatsapp);

    // ── Qualificação automática ──────────────────────────
    const qualResult = this.qualification.qualify({
      name: dto.nome,
      phone: dto.whatsapp,
      email: dto.email,
      instagram: dto.instagram,
      monthlyRevenue: dto.faturamento_mensal ?? dto.faturamento,
      saleModel: dto.modelo_venda,
      utmSource: dto.utm_source,
      utmMedium: dto.utm_medium,
      utmCampaign: dto.utm_campaign,
    });

    const notes = [
      '[Formulário Landing Page]',
      dto.faturamento_mensal ? `Faturamento: ${dto.faturamento_mensal}` : '',
      dto.modelo_venda ? `Modelo de venda: ${dto.modelo_venda}` : '',
      dto.investimento_atual ? `Investimento atual: ${dto.investimento_atual}` : '',
      dto.faturamento ? `Faturamento (antigo): ${dto.faturamento}` : '',
      dto.atendimento_leads ? `Atendimento de leads: ${dto.atendimento_leads}` : '',
      dto.interesse ? `Interesse: ${dto.interesse}` : '',
      `Qualificação automática: ${qualResult.qualification} (score: ${qualResult.score})`,
      `Motivos: ${qualResult.reasons.join(', ')}`,
      `Origem: ${dto.origem ?? dto.utm_source ?? 'form'}`,
    ].filter(Boolean).join('\n');

    // Tags automáticas por qualificação
    const qualTags: Record<string, string> = {
      ULTRA: 'icp-ultra',
      QUALIFIED: 'qualificado',
      COLD: 'frio',
      UNQUALIFIED: 'sem-qualificacao',
    };

    const tags = [
      'trafego-pago',
      qualTags[qualResult.qualification],
      dto.interesse ? `interesse:${dto.interesse}` : null,
      dto.utm_source ? `utm:${dto.utm_source}` : null,
    ].filter(Boolean) as string[];

    // upsert contato
    const contact = await this.prisma.contact.upsert({
      where: { tenantId_phone: { tenantId, phone: formattedPhone } },
      create: {
        tenantId,
        name: dto.nome,
        phone: formattedPhone,
        email: dto.email,
        instagramHandle: dto.instagram,
        tags,
        notes,
        qualification: qualResult.qualification,
        leadScore: qualResult.score,
        monthlyRevenue: dto.faturamento_mensal ?? dto.faturamento,
        saleModel: dto.modelo_venda,
        utmSource: dto.utm_source,
        utmMedium: dto.utm_medium,
        utmCampaign: dto.utm_campaign,
      },
      update: {
        name: dto.nome,
        email: dto.email,
        instagramHandle: dto.instagram,
        tags,
        notes,
        qualification: qualResult.qualification,
        leadScore: qualResult.score,
        monthlyRevenue: dto.faturamento_mensal ?? dto.faturamento,
        saleModel: dto.modelo_venda,
        utmSource: dto.utm_source,
        utmMedium: dto.utm_medium,
        utmCampaign: dto.utm_campaign,
      },
    });

    // Funil Tráfego Pago
    let pipeline = await this.prisma.pipeline.findFirst({
      where: { tenantId, name: 'Tráfego Pago' },
      include: { stages: true },
    });

    if (!pipeline) {
      pipeline = await this.prisma.pipeline.create({
        data: {
          tenantId,
          name: 'Tráfego Pago',
          stages: {
            create: [
              { name: 'Preencheu Formulário', color: '#7C3AED', position: 0 },
              { name: 'Em Contato',           color: '#3B82F6', position: 1 },
              { name: 'Reunião Agendada',     color: '#F59E0B', position: 2 },
              { name: 'Proposta Enviada',     color: '#10B981', position: 3 },
              { name: 'Fechado',              color: '#6B7280', position: 4 },
            ],
          },
        },
        include: { stages: true },
      });
    }

    let stage = pipeline.stages.find((s) => s.name === 'Preencheu Formulário');
    if (!stage) {
      stage = await this.prisma.pipelineStage.create({
        data: { pipelineId: pipeline.id, name: 'Preencheu Formulário', color: '#7C3AED', position: 0 },
      });
    }

    const position = await this.prisma.pipelineLead.count({ where: { stageId: stage.id } });

    const lead = await this.prisma.pipelineLead.create({
      data: {
        stageId: stage.id,
        contactId: contact.id,
        notes: `${qualResult.qualification} (score: ${qualResult.score}) | ${qualResult.reasons.join(', ')}`,
        position,
      },
    });

    this.logger.log(`Lead criado: ${lead.id} → ${qualResult.qualification} (score: ${qualResult.score})`);
    return { success: true, leadId: lead.id, qualification: qualResult };
  }
}
