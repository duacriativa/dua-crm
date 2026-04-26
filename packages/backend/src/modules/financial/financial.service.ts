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
        summary.paid.total + summary.pending.total > 0
          ? (summary.pending.total /
              (summary.paid.total + summary.pending.total)) *
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
    // Por enquanto usando R$1.200 fixo de ads (variável de ambiente futura)
    const adsSpend = 1200;
    const newClientsThisMonth = await this.prisma.contract.count({
      where: {
        tenantId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });
    const cac = newClientsThisMonth > 0 ? adsSpend / newClientsThisMonth : 0;

    return {
      ...summary,
      activeContracts,
      ticketMedio: Math.round(ticketMedio),
      ltv: Math.round(ltv),
      cac: Math.round(cac),
      ltvCacRatio: cac > 0 ? Math.round((ltv / cac) * 10) / 10 : 0,
    };
  }
}
