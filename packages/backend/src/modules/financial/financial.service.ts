import { Injectable, Logger } from '@nestjs/common';
import { AsaasService } from '../asaas/asaas.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAdsService } from '../meta-ads/meta-ads.service';
import { diaBR, somaDias } from '../../common/periodo-br.util';
import { normalizeName } from './asaas-sync.service';

@Injectable()
export class FinancialService {
  private readonly logger = new Logger(FinancialService.name);
  constructor(
    private asaas: AsaasService,
    private prisma: PrismaService,
    private metaAds: MetaAdsService,
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

    // CAC (investimento no Meta Ads ÷ novos clientes) nos últimos 30 dias.
    // Sem Meta Ads conectado não há investimento real: CAC fica 0 ("—" na tela).
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = diaBR();
    const adsSpend = await this.metaAds.insights(tenantId, somaDias(today, -29), today)
      .then((m) => m?.spend ?? 0)
      .catch((err) => { this.logger.warn(err.message); return 0; });
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

  /**
   * Painel mês a mês: lê só do banco. As cobranças do Asaas chegam como FinancialEntry pelo
   * AsaasSyncService (webhook + varredura); quem paga fora do Asaas segue com o lançamento manual.
   */
  async getClientes(tenantId: string, month?: string) {
    const now = new Date();
    const [year, mon] = month
      ? month.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    // Vencimentos do Asaas são gravados ao meio-dia UTC, então o mês é recortado em UTC
    const startOfMonth = new Date(Date.UTC(year, mon - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, mon, 1));
    const inMonth = { gte: startOfMonth, lt: endOfMonth };

    // Contrato cancelado depois não some dos meses em que estava ativo
    const contracts = await this.prisma.contract.findMany({
      where: {
        tenantId,
        startsAt: { lt: endOfMonth },
        OR: [
          { status: 'ACTIVE' },
          { cancelledAt: { gte: startOfMonth } },
          { financialEntries: { some: { dueDate: inMonth, isCommission: false, status: { not: 'CANCELLED' } } } },
        ],
      },
      orderBy: { clientName: 'asc' },
      include: {
        financialEntries: {
          where: { dueDate: inMonth, isCommission: false, status: { not: 'CANCELLED' } },
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
      const entries = c.financialEntries;
      let entry: {
        id: string | null; status: string; paidAt: Date | null; dueDate: Date | null;
        value: number; paid: number; source: 'asaas' | 'manual';
      } | null = null;
      if (entries.length) {
        const open = entries.filter((e) => e.status !== 'PAID');
        const paid = entries.filter((e) => e.status === 'PAID');
        const paidAts = paid.map((e) => e.paidAt).filter(Boolean) as Date[];
        entry = {
          // id da cobrança em aberto (o botão Pago/Pendente do lançamento manual usa ele)
          id: (open[0] ?? entries[0]).id,
          status: !open.length ? 'PAID' : open.some((e) => e.status === 'OVERDUE') ? 'OVERDUE' : 'PENDING',
          paidAt: paidAts.length ? new Date(Math.max(...paidAts.map((d) => d.getTime()))) : null,
          dueDate: (open[0] ?? entries[0]).dueDate,
          value: entries.reduce((s, e) => s + e.value, 0),
          paid: paid.reduce((s, e) => s + e.value, 0),
          source: entries.some((e) => e.asaasPaymentId) ? 'asaas' : 'manual',
        };
      }

      return {
        contractId: c.id,
        clientName: c.clientName,
        serviceType: c.serviceType,
        serviceLabel: SERVICE_LABELS[c.serviceType] ?? c.serviceType,
        monthlyValue: c.monthlyValue,
        linked: !!c.asaasCustomerId,
        entry,
      };
    });

    const received = (c: (typeof clients)[number]) => c.entry?.paid ?? 0;
    const missing = (c: (typeof clients)[number]) =>
      c.entry?.status === 'PAID' ? 0 : Math.max(c.monthlyValue - received(c), 0);

    const byService: Record<string, { label: string; contratado: number; recebido: number; pendente: number }> = {};
    for (const c of clients) {
      const svc = (byService[c.serviceType] ??= { label: c.serviceLabel, contratado: 0, recebido: 0, pendente: 0 });
      svc.contratado += c.monthlyValue;
      svc.recebido += received(c);
      svc.pendente += missing(c);
    }

    return {
      month: `${year}-${String(mon).padStart(2, '0')}`,
      totals: {
        contratado: clients.reduce((s, c) => s + c.monthlyValue, 0),
        recebido: clients.reduce((s, c) => s + received(c), 0),
        pendente: clients.reduce((s, c) => s + missing(c), 0),
      },
      clientCount: new Set(clients.map((c) => normalizeName(c.clientName))).size,
      unlinkedCount: clients.filter((c) => !c.linked).length,
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
        dueDate: new Date(`${dto.dueDate.slice(0, 10)}T12:00:00Z`),
      },
    });
  }

  async togglePay(tenantId: string, entryId: string, paid: boolean) {
    return this.prisma.financialEntry.updateMany({
      // Cobrança do Asaas só muda pelo Asaas
      where: { id: entryId, tenantId, asaasPaymentId: null },
      data: {
        status: paid ? 'PAID' : 'PENDING',
        paidAt: paid ? new Date() : null,
      },
    });
  }
}
