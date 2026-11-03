import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { AsaasCustomer, AsaasPayment, AsaasService } from '../asaas/asaas.service';
import { PrismaService } from '../../prisma/prisma.service';

const SYNC_MS = 6 * 60 * 60 * 1000;

/** Nome "comparável": sem acento, caixa, pontuação e sufixos de empresa. */
export function normalizeName(s: string) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(ltda|me|eireli|mei|epp|sa|comercio|confeccoes|store|shop|moda|modas)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** YYYY-MM-DD do Asaas → meio-dia UTC, para cair no mesmo dia em qualquer fuso. */
function asaasDate(d?: string | null) {
  return d ? new Date(`${d.slice(0, 10)}T12:00:00Z`) : null;
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mapStatus(p: AsaasPayment): PaymentStatus {
  if (p.deleted || p.status === 'REFUNDED' || p.status === 'REFUND_REQUESTED') return 'CANCELLED';
  if (p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH') return 'PAID';
  if (p.status === 'OVERDUE') return 'OVERDUE';
  return 'PENDING';
}

/**
 * Toda cobrança do Asaas vira um FinancialEntry do contrato ligado ao cliente do Asaas
 * (Contract.asaasCustomerId). Assim o Financeiro lê só do banco e qualquer mês fica no histórico.
 * Entradas: webhook (na hora), varredura a cada 6h (mês passado → mês que vem) e o botão Sincronizar.
 */
@Injectable()
export class AsaasSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsaasSyncService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly asaas: AsaasService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (!process.env.ASAAS_API_KEY) return;
    setTimeout(() => this.syncDefaultRange().catch(() => {}), 3 * 60 * 1000).unref();
    this.timer = setInterval(() => this.syncDefaultRange().catch(() => {}), SYNC_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Do 1º dia de N meses atrás até o fim do mês que vem. */
  async syncDefaultRange(monthsBack = 1) {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0));
    return this.syncRange(ymd(from), ymd(to));
  }

  async syncRange(from: string, to: string) {
    if (this.running) return { skipped: true, synced: 0, unlinked: 0 };
    this.running = true;
    try {
      const payments = await this.asaas.getPaymentsByDueRange(from, to);
      let synced = 0;
      let unlinked = 0;
      for (const p of payments) {
        if (await this.upsertPayment(p)) synced++;
        else unlinked++;
      }
      this.logger.log(`Asaas sync ${from}..${to}: ${synced} lançadas, ${unlinked} sem contrato`);
      return { skipped: false, synced, unlinked };
    } catch (err: any) {
      this.logger.error('Asaas sync falhou: ' + err.message);
      throw err;
    } finally {
      this.running = false;
    }
  }

  /** Webhook: busca a cobrança na API (não confia no corpo recebido) e grava. */
  async syncPaymentById(id: string) {
    const payment = await this.asaas.getPayment(id);
    return this.upsertPayment(payment);
  }

  /** Todas as cobranças de um cliente, ex.: logo depois de vincular o contrato. */
  async syncCustomer(customerId: string) {
    const res = await this.asaas.getPaymentsByCustomer(customerId);
    for (const p of res.data || []) await this.upsertPayment(p);
  }

  /** Grava a cobrança no contrato certo. Retorna false quando o cliente do Asaas não tem contrato vinculado. */
  async upsertPayment(p: AsaasPayment): Promise<boolean> {
    if (!p?.id) return false;
    const existing = await this.prisma.financialEntry.findUnique({ where: { asaasPaymentId: p.id } });

    // Sempre recalcula: o resultado não pode depender da ordem em que os contratos foram vinculados
    const contract = await this.pickContract(p);
    if (!contract) {
      // Cliente desvinculado: o lançamento antigo não vale mais para nenhum contrato
      if (existing?.asaasPaymentId && existing.contractId) {
        await this.prisma.financialEntry.delete({ where: { id: existing.id } });
      }
      return false;
    }

    const status = mapStatus(p);
    const data = {
      tenantId: contract.tenantId,
      contractId: contract.id,
      clientName: contract.clientName,
      description: p.description || 'Mensalidade',
      value: Number(p.value ?? 0),
      status,
      dueDate: asaasDate(p.dueDate) ?? new Date(),
      paidAt: status === 'PAID' ? asaasDate(p.clientPaymentDate || p.paymentDate || p.confirmedDate) ?? new Date() : null,
    };
    await this.prisma.financialEntry.upsert({
      where: { asaasPaymentId: p.id },
      create: { ...data, asaasPaymentId: p.id },
      update: data,
    });
    return true;
  }

  /**
   * Um cliente do Asaas pode ter mais de um contrato (Redes + Anúncios): a cobrança vai para o
   * contrato de mesmo valor (valor original, sem juros); sem empate exato, para o mais próximo.
   */
  private async pickContract(p: AsaasPayment) {
    if (!p.customer) return null;
    const contracts = await this.prisma.contract.findMany({
      where: { asaasCustomerId: p.customer },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    if (contracts.length <= 1) return contracts[0] ?? null;
    const base = Number(p.originalValue ?? p.value ?? 0);
    return contracts.reduce((best, c) =>
      Math.abs(c.monthlyValue - base) < Math.abs(best.monthlyValue - base) ? c : best,
    );
  }

  /** Contratos com o cliente do Asaas vinculado (ou sugerido pelo nome) e a lista de clientes do Asaas. */
  async getLinks(tenantId: string) {
    const [contracts, customers] = await Promise.all([
      this.prisma.contract.findMany({
        where: { tenantId, status: 'ACTIVE' },
        orderBy: [{ clientName: 'asc' }, { serviceType: 'asc' }],
        select: { id: true, clientName: true, serviceType: true, monthlyValue: true, asaasCustomerId: true, notes: true },
      }),
      this.asaas.getAllCustomers(),
    ]);

    const byKey = new Map<string, AsaasCustomer>();
    for (const c of customers) {
      const key = normalizeName(c.name);
      if (key) byKey.set(key, c);
    }
    const suggest = (names: string[]) => {
      for (const name of names) {
        const target = normalizeName(name);
        if (target.length < 3) continue;
        if (byKey.has(target)) return byKey.get(target)!;
        let best: { key: string; c: AsaasCustomer } | null = null;
        for (const [key, c] of byKey) {
          if (key.length < 3) continue;
          if (key.includes(target) || target.includes(key)) {
            if (!best || key.length > best.key.length) best = { key, c };
          }
        }
        if (best) return best.c;
      }
      return null;
    };

    return {
      customers: customers
        .map((c) => ({ id: c.id, name: c.name, cpfCnpj: c.cpfCnpj ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      contracts: contracts.map((c) => {
        // "Marca: USE LOVA" nas notas ajuda quando o contrato está no nome da pessoa
        const brand = c.notes?.match(/marca:\s*(.+)/i)?.[1]?.trim();
        const suggestion = c.asaasCustomerId ? null : suggest([c.clientName, ...(brand ? [brand] : [])]);
        return {
          id: c.id,
          clientName: c.clientName,
          serviceType: c.serviceType,
          monthlyValue: c.monthlyValue,
          asaasCustomerId: c.asaasCustomerId,
          suggestedCustomerId: suggestion?.id ?? null,
        };
      }),
    };
  }

  async setLink(tenantId: string, contractId: string, asaasCustomerId: string | null) {
    const contract = await this.prisma.contract.findFirst({ where: { id: contractId, tenantId } });
    if (!contract) throw new Error('Contrato não encontrado');
    const previous = contract.asaasCustomerId;
    await this.prisma.contract.update({ where: { id: contractId }, data: { asaasCustomerId } });

    // Reprocessa as cobranças do cliente antigo e do novo para cada uma cair no contrato certo
    for (const customerId of new Set([previous, asaasCustomerId].filter(Boolean) as string[])) {
      await this.syncCustomer(customerId).catch((err) => this.logger.warn(`syncCustomer ${customerId}: ${err.message}`));
    }
    return { ok: true };
  }
}
