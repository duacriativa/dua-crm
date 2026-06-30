import { Injectable, Logger } from '@nestjs/common';
import { AsaasService } from '../asaas/asaas.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinancialService {
  private readonly logger = new Logger(FinancialService.name);
  constructor(
    private asaas: AsaasService,
    private prisma: PrismaService,
  ) {}

  async getSummary(tenantId: string) {
    let summary: any;
    try {
      summary = await this.asaas.getMonthlySummary();
    } catch (err: any) {
      this.logger.error('Erro Asaas: ' + err.message);
      // Retorna zeros se Asaas falhar — não quebra a tela
      summary = {
        month: new Date().toISOString().slice(0, 7),
        paid: { total: 0, count: 0, items: [] },
        pending: { total: 0, count: 0, items: [] },
        overdue: { total: 0, count: 0, items: [] },
      };
    }

    // Enriquecer com dados locais (parcelas, comissões)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const localEntries = await this.prisma.financialEntry.findMany({
      where: {
        tenantId,
        dueDate: { gte: startOfMonth, lte: endOfMonth },
      },
      orderBy: { dueDate: 'asc' },
    });

    const commissions = localEntries.filter((e) => e.isCommission);
    const commissionTotal = commissions.reduce((acc, e) => acc + e.value, 0);

    // Agrupar pendentes do Asaas por cliente
    const pendingByClient = summary.pending.items.reduce(
      (acc: Record<string, { name: string; total: number; items: any[] }>, p) => {
        const key = p.customer;
        if (!acc[key]) {
          acc[key] = {
            name: p.customerName || p.customer,
            total: 0,
            items: [],
          };
        }
        acc[key].total += p.value;
        acc[key].items.push(p);
        return acc;
      },
      {},
    );

    return {
      month: summary.month,
      received: summary.paid.total,
      receivedCount: summary.paid.count,
      pending: summary.pending.total,
      pendingCount: summary.pending.count,
      overdue: summary.overdue.total,
      overdueCount: summary.overdue.count,
      total: summary.paid.total + summary.pending.total,
      inadimplencyRate:
        summary.paid.total + summary.overdue.total > 0
          ? (summary.overdue.total /
              (summary.paid.total + summary.overdue.total)) *
            100
          : 0,
      commissions: {
        total: commissionTotal,
        items: commissions,
      },
      pendingByClient: Object.values(pendingByClient),
      paidItems: summary.paid.items,
      pendingItems: summary.pending.items,
      overdueItems: summary.overdue.items,
    };
  }

  async getDashboardMetrics(tenantId: string) {
    const summary = await this.getSummary(tenantId);

    // Contratos ativos
    const activeContracts = await this.prisma.contract.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    // Ticket médio (baseado em contratos ativos)
    const contracts = await this.prisma.contract.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { monthlyValue: true },
    });
    const ticketMedio =
      contracts.length > 0
        ? contracts.reduce((acc, c) => acc + c.monthlyValue, 0) /
          contracts.length
        : 0;

    // LTV estimado (ticket médio × tempo médio de contrato em meses)
    // Usando 8 meses como baseline até ter histórico suficiente
    const avgRetentionMonths = 8;
    const ltv = ticketMedio * avgRetentionMonths;

    // CAC (gasto em ads / novos clientes no mês)
    // Conta contratos assinados nos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const adsSpend = 1200;
    const newClientsThisMonth = await this.prisma.contract.count({
      where: {
        tenantId,
        signedAt: { gte: thirtyDaysAgo },
        status: 'ACTIVE',
      },
    });
    const cac = newClientsThisMonth > 0 ? Math.round(adsSpend / newClientsThisMonth) : 0;

    return {
      ...summary,
      activeContracts,
      ticketMedio: Math.round(ticketMedio),
      ltv: Math.round(ltv),
      cac: Math.round(cac),
      ltvCacRatio: cac > 0 ? Math.round((ltv / cac) * 10) / 10 : 0,
    };
  }

  async getClientes(tenantId: string, month?: string) {
    const now = new Date();
    const [year, mon] = month
      ? month.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 0, 23, 59, 59);

    const contracts = await this.prisma.contract.findMany({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { clientName: 'asc' },
      include: {
        financialEntries: {
          where: { dueDate: { gte: startOfMonth, lte: endOfMonth }, isCommission: false },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    const SERVICE_LABELS: Record<string, string> = {
      SOCIAL_MEDIA: 'G. Redes',
      PAID_TRAFFIC: 'G. Anúncios',
      CRM_SETUP: 'CRM',
      CONSULTING: 'Consultoria',
      OTHER: 'Outro',
    };

    const clients = contracts.map((c) => {
      const entry = c.financialEntries[0] ?? null;
      return {
        contractId: c.id,
        clientName: c.clientName,
        serviceType: c.serviceType,
        serviceLabel: SERVICE_LABELS[c.serviceType] ?? c.serviceType,
        monthlyValue: c.monthlyValue,
        entry: entry
          ? { id: entry.id, status: entry.status, paidAt: entry.paidAt, dueDate: entry.dueDate, value: entry.value }
          : null,
      };
    });

    const contratado = clients.reduce((s, c) => s + c.monthlyValue, 0);
    const recebido = clients
      .filter((c) => c.entry?.status === 'PAID')
      .reduce((s, c) => s + (c.entry?.value ?? c.monthlyValue), 0);
    const pendente = clients
      .filter((c) => !c.entry || c.entry.status === 'PENDING')
      .reduce((s, c) => s + c.monthlyValue, 0);

    const byService: Record<string, { label: string; contratado: number; recebido: number; pendente: number }> = {};
    for (const c of clients) {
      if (!byService[c.serviceType]) {
        byService[c.serviceType] = { label: c.serviceLabel, contratado: 0, recebido: 0, pendente: 0 };
      }
      byService[c.serviceType].contratado += c.monthlyValue;
      if (c.entry?.status === 'PAID') {
        byService[c.serviceType].recebido += c.entry.value;
      } else {
        byService[c.serviceType].pendente += c.monthlyValue;
      }
    }

    return {
      month: `${year}-${String(mon).padStart(2, '0')}`,
      totals: { contratado, recebido, pendente },
      byService,
      clients,
    };
  }

  async createEntry(tenantId: string, dto: { contractId: string; value: number; dueDate: string; description?: string }) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: dto.contractId, tenantId },
    });
    if (!contract) throw new Error('Contrato não encontrado');

    return this.prisma.financialEntry.create({
      data: {
        tenantId,
        contractId: dto.contractId,
        clientName: contract.clientName,
        description: dto.description ?? 'Mensalidade',
        value: dto.value,
        status: 'PENDING',
        dueDate: new Date(dto.dueDate),
      },
    });
  }

  async togglePay(tenantId: string, entryId: string, paid: boolean) {
    return this.prisma.financialEntry.updateMany({
      where: { id: entryId, tenantId },
      data: {
        status: paid ? 'PAID' : 'PENDING',
        paidAt: paid ? new Date() : null,
      },
    });
  }
}
