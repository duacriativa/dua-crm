import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { IsString, IsIn, IsOptional } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

export class CreatePublicLeadDto {
  @IsString()
  nome: string;

  @IsString()
  whatsapp: string;

  @IsString()
  instagram: string;

  @IsString()
  investimento_atual: string;

  @IsString()
  faturamento: string;

  @IsString()
  atendimento_leads: string;

  @IsIn(['combo', 'trafego', 'frio'])
  interesse: 'combo' | 'trafego' | 'frio';

  @IsOptional()
  @IsString()
  origem?: string;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async resolveTenantId(): Promise<string> {
    const slug = process.env.PUBLIC_LEAD_TENANT_SLUG;

    if (slug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
      if (tenant) return tenant.id;
    }

    // Fallback: primeiro tenant ativo
    const first = await this.prisma.tenant.findFirst({ where: { active: true } });
    if (!first) throw new InternalServerErrorException('Nenhum tenant encontrado');
    return first.id;
  }

  async createPublicLead(dto: CreatePublicLeadDto) {
    const tenantId = await this.resolveTenantId();

    const notes = [
      '[Formulário Tráfego Pago]',
      `Investimento atual: ${dto.investimento_atual}`,
      `Faturamento: ${dto.faturamento}`,
      `Atendimento de leads: ${dto.atendimento_leads}`,
      `Interesse: ${dto.interesse}`,
      `Origem: ${dto.origem ?? 'trafegopago-form'}`,
    ].join('\n');

    // upsert: evita erro P2002 se o mesmo telefone já existir no tenant
    const contact = await this.prisma.contact.upsert({
      where: { tenantId_phone: { tenantId, phone: dto.whatsapp } },
      create: {
        tenantId,
        name: dto.nome,
        phone: dto.whatsapp,
        instagramHandle: dto.instagram,
        tags: ['trafego-pago', `interesse:${dto.interesse}`],
        notes,
      },
      update: {
        name: dto.nome,
        instagramHandle: dto.instagram,
        tags: ['trafego-pago', `interesse:${dto.interesse}`],
        notes,
      },
    });

    // Busca ou cria o funil "Tráfego Pago"
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
        data: {
          pipelineId: pipeline.id,
          name: 'Preencheu Formulário',
          color: '#7C3AED',
          position: 0,
        },
      });
    }

    const position = await this.prisma.pipelineLead.count({
      where: { stageId: stage.id },
    });

    const lead = await this.prisma.pipelineLead.create({
      data: {
        stageId: stage.id,
        contactId: contact.id,
        notes: `${dto.interesse} | ${dto.investimento_atual}`,
        position,
      },
    });

    this.logger.log(`Lead público criado: ${lead.id} (tenant: ${tenantId})`);
    return { success: true, leadId: lead.id };
  }
}
