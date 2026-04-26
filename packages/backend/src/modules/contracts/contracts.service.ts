import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { tenantId },
      orderBy: { signedAt: 'desc' },
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
        financialEntries: {
          orderBy: { dueDate: 'asc' },
        },
      },
    });
    if (!contract) throw new NotFoundException('Contrato não encontrado');
    return { ...contract, anniversaryInfo: this.getAnniversaryInfo(contract.signedAt) };
  }

  async create(tenantId: string, dto: CreateContractDto) {
    return this.prisma.contract.create({
      data: {
        tenantId,
        clientName: dto.clientName,
        clientEmail: dto.clientEmail,
        clientPhone: dto.clientPhone,
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
