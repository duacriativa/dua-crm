import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { tenantId },
      orderBy: { signedAt: 'desc' },
      include: { contact: { select: { id: true, name: true, phone: true } } },
    });

    return contracts.map((c) => ({
      ...c,
      anniversaryInfo: this.getAnniversaryInfo(c.signedAt),
    }));
  }

  async findOne(tenantId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { tenantId, id },
      include: {
        financialEntries: { orderBy: { dueDate: 'asc' } },
        contact: { select: { id: true, name: true, phone: true, qualification: true } },
      },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado');
    return { ...contract, anniversaryInfo: this.getAnniversaryInfo(contract.signedAt) };
  }

  async create(tenantId: string, dto: CreateContractDto) {
    // 1. Tenta encontrar o contato pelo telefone ou nome
    let contactId: string | null = null;

    if (dto.clientPhone) {
      const phone = dto.clientPhone.replace(/\D/g, '');
      const contact = await this.prisma.contact.findFirst({
        where: {
          tenantId,
          OR: [
            { phone: { contains: phone } },
            { phone: { endsWith: phone.slice(-8) } },
          ],
        },
      });
      if (contact) contactId = contact.id;
    }

    // Fallback: busca por nome similar
    if (!contactId && dto.clientName) {
      const namePart = dto.clientName.split(' ')[0].toLowerCase();
      const contact = await this.prisma.contact.findFirst({
        where: {
          tenantId,
          name: { contains: namePart, mode: 'insensitive' },
        },
      });
      if (contact) contactId = contact.id;
    }

    // 2. Cria o contrato
    const contract = await this.prisma.contract.create({
      data: {
        tenantId,
        clientName: dto.clientName,
        clientEmail: dto.clientEmail,
        clientPhone: dto.clientPhone,
        contactId,
        asaasCustomerId: dto.asaasCustomerId,
        serviceType: dto.serviceType,
        description: dto.description,
        totalValue: dto.totalValue,
        monthlyValue: dto.monthlyValue,
        installments: dto.installments ?? 1,
        signedAt: new Date(dto.signedAt),
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        clicksignDocId: dto.clicksignDocId,
        notes: dto.notes,
      },
    });

    // 3. Se encontrou contato, move lead para "Fechado" no funil
    if (contactId) {
      await this.moveLeadToWon(tenantId, contactId, dto.monthlyValue);
      this.logger.log(`Lead ${contactId} movido para Fechado — contrato ${contract.id}`);
    }

    return contract;
  }

  // Move lead para estágio "Fechado" no funil e registra o valor
  private async moveLeadToWon(tenantId: string, contactId: string, value: number) {
    // Busca funis do tenant
    const pipelines = await this.prisma.pipeline.findMany({
      where: { tenantId },
      include: { stages: true },
    });

    for (const pipeline of pipelines) {
      // Verifica se o contato tem lead nesse funil
      const pipelineLead = await this.prisma.pipelineLead.findFirst({
        where: {
          contactId,
          stage: { pipelineId: pipeline.id },
        },
        include: { stage: true },
      });

      if (!pipelineLead) continue;

      // Já está fechado? Pula
      if (pipelineLead.stage.name === 'Fechado') continue;

      // Busca ou cria estágio "Fechado"
      let wonStage = pipeline.stages.find((s) => s.name === 'Fechado');
      if (!wonStage) {
        wonStage = await this.prisma.pipelineStage.create({
          data: {
            pipelineId: pipeline.id,
            name: 'Fechado',
            color: '#10B981',
            position: pipeline.stages.length,
          },
        });
      }

      const position = await this.prisma.pipelineLead.count({
        where: { stageId: wonStage.id },
      });

      // Move o lead para Fechado com o valor do contrato
      await this.prisma.pipelineLead.update({
        where: { id: pipelineLead.id },
        data: {
          stageId: wonStage.id,
          value,
          position,
          notes: `Contrato fechado — R$${value}/mês`,
        },
      });
    }
  }

  async cancel(tenantId: string, id: string, reason: string) {
    await this.findOne(tenantId, id);
    return this.prisma.contract.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date(),
      },
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateContractDto>) {
    await this.findOne(tenantId, id);
    return this.prisma.contract.update({
      where: { id },
      data: {
        ...dto,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : undefined,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  // Retorna contratos com aniversário nos próximos 7 dias
  async getUpcomingAnniversaries(tenantId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { tenantId, status: 'ACTIVE' },
    });

    const today = new Date();
    const upcoming: any[] = [];

    for (const contract of contracts) {
      const info = this.getAnniversaryInfo(contract.signedAt);
      const daysUntilNext = info.daysUntilNextAnniversary;
      if (daysUntilNext !== null && daysUntilNext <= 30) {
        upcoming.push({
          ...contract,
          anniversaryInfo: info,
        });
      }
    }

    return upcoming.sort(
      (a, b) =>
        (a.anniversaryInfo.daysUntilNextAnniversary ?? 999) -
        (b.anniversaryInfo.daysUntilNextAnniversary ?? 999),
    );
  }

  private getAnniversaryInfo(signedAt: Date) {
    const today = new Date();
    const signed = new Date(signedAt);

    // Meses completos desde assinatura
    const monthsActive =
      (today.getFullYear() - signed.getFullYear()) * 12 +
      (today.getMonth() - signed.getMonth());

    // Próximo aniversário (data do mesmo dia-do-mês no próximo mês)
    const nextAnniversary = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      signed.getDate(),
    );

    const daysUntilNextAnniversary = Math.ceil(
      (nextAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Marcos importantes
    const milestones = [3, 6, 12, 24, 36];
    const nextMilestone = milestones.find((m) => m > monthsActive) ?? null;
    const monthsToNextMilestone = nextMilestone
      ? nextMilestone - monthsActive
      : null;

    return {
      monthsActive,
      nextAnniversary: nextAnniversary.toISOString().split('T')[0],
      daysUntilNextAnniversary,
      nextMilestone,
      monthsToNextMilestone,
      isUpsellOpportunity: monthsActive > 0 && monthsActive % 3 === 0,
    };
  }
}
