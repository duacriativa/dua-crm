import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);

  constructor(private config: ConfigService) {}

  /** Produção por padrão; para testar use ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3 com a chave do sandbox. */
  private get baseUrl() {
    return (this.config.get<string>('ASAAS_BASE_URL') || 'https://api.asaas.com/v3').replace(/\/$/, '');
  }

  get isSandbox() {
    return this.baseUrl.includes('sandbox');
  }

  private get apiKey() {
    return this.config.get<string>('ASAAS_API_KEY') ?? '';
  }

  private async fetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    this.logger.debug(`Asaas ${init?.method ?? 'GET'} ${url}`);
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20000),
      headers: {
        access_token: this.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'dua-crm/1.0',
      },
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`Asaas API ${res.status}: ${text}`);
      throw new Error(`Asaas retornou ${res.status}: ${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Asaas resposta inválida: ${text.slice(0, 200)}`);
    }
  }

  async getCustomers(limit = 100, offset = 0) {
    return this.fetch<{ data: AsaasCustomer[]; totalCount: number; hasMore: boolean }>(
      `/customers?limit=${limit}&offset=${offset}`,
    );
  }

  async getAllCustomers(): Promise<AsaasCustomer[]> {
    const all: AsaasCustomer[] = [];
    let offset = 0;
    const limit = 100;
    while (true) {
      const result = await this.getCustomers(limit, offset).catch(() => ({ data: [], totalCount: 0, hasMore: false }));
      all.push(...(result.data || []));
      if (!result.hasMore || (result.data || []).length < limit) break;
      offset += limit;
    }
    return all;
  }

  async getPayments(status?: string, limit = 100) {
    const qs = status ? `?status=${status}&limit=${limit}` : `?limit=${limit}`;
    return this.fetch<{ data: AsaasPayment[]; totalCount: number }>(
      `/payments${qs}`,
    );
  }

  async getPaymentsByCustomer(customerId: string) {
    return this.fetch<{ data: AsaasPayment[]; totalCount: number }>(
      `/payments?customer=${customerId}&limit=100`,
    );
  }

  async getSubscriptions() {
    return this.fetch<{ data: AsaasSubscription[]; totalCount: number }>(
      `/subscriptions?limit=100`,
    );
  }

  /** Cliente pelo CPF/CNPJ; cria se não existir. O Asaas exige CPF/CNPJ para emitir cobrança. */
  async findOrCreateCustomer(input: { name: string; cpfCnpj: string; email: string; mobilePhone: string; externalReference?: string }) {
    const found = await this.fetch<{ data: AsaasCustomer[] }>(`/customers?cpfCnpj=${encodeURIComponent(input.cpfCnpj)}&limit=1`);
    if (found.data?.[0]) return found.data[0];
    // notificationDisabled: o Asaas não manda e-mail/SMS próprio, a comunicação é da Dua
    return this.fetch<AsaasCustomer>('/customers', { method: 'POST', body: { ...input, notificationDisabled: true } });
  }

  async createPixPayment(input: { customer: string; value: number; dueDate: string; description: string; externalReference: string }) {
    return this.fetch<AsaasPayment>('/payments', { method: 'POST', body: { ...input, billingType: 'PIX' } });
  }

  async getPayment(id: string) {
    return this.fetch<AsaasPayment>(`/payments/${encodeURIComponent(id)}`);
  }

  /** QR Code (PNG em base64) e copia-e-cola do Pix da cobrança. */
  async getPixQrCode(id: string) {
    return this.fetch<{ encodedImage: string; payload: string; expirationDate?: string }>(`/payments/${encodeURIComponent(id)}/pixQrCode`);
  }

  /** Só no sandbox: simula o pagamento da cobrança (dispara o webhook PAYMENT_RECEIVED). */
  async confirmSandboxPayment(id: string) {
    return this.fetch<AsaasPayment>(`/sandbox/payment/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: {} });
  }

  // Resumo financeiro do mês atual
  async getMonthlySummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    const [paid, pending, overdue, customers] = await Promise.all([
      this.fetch<{ data: AsaasPayment[] }>(
        `/payments?status=RECEIVED&dueDate[ge]=${startOfMonth}&dueDate[le]=${endOfMonth}&limit=100`,
      ),
      this.fetch<{ data: AsaasPayment[] }>(
        `/payments?status=PENDING&dueDate[ge]=${startOfMonth}&dueDate[le]=${endOfMonth}&limit=100`,
      ),
      this.fetch<{ data: AsaasPayment[] }>(
        `/payments?status=OVERDUE&limit=100`,
      ),
      this.fetch<{ data: AsaasCustomer[] }>(
        `/customers?limit=100`,
      ),
    ]);

    // Mapa id -> nome do cliente
    const customerMap = new Map<string, string>();
    customers.data.forEach((c) => customerMap.set(c.id, c.name));

    // Enriquecer pagamentos com nome do cliente
    const enrich = (payments: AsaasPayment[]) =>
      payments.map((p) => ({
        ...p,
        customerName: customerMap.get(p.customer) ?? p.customer,
      }));

    const sum = (payments: AsaasPayment[]) =>
      payments.reduce((acc, p) => acc + p.value, 0);

    const enrichedPaid = enrich(paid.data);
    const enrichedPending = enrich(pending.data);
    const enrichedOverdue = enrich(overdue.data);

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      paid: { total: sum(paid.data), count: paid.data.length, items: enrichedPaid },
      pending: { total: sum(pending.data), count: pending.data.length, items: enrichedPending },
      overdue: { total: sum(overdue.data), count: overdue.data.length, items: enrichedOverdue },
    };
  }
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  customerName?: string;
  value: number;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH';
  dueDate: string;
  paymentDate?: string;
  description?: string;
  billingType: string;
  invoiceUrl?: string;
  subscription?: string;
  externalReference?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  status: 'ACTIVE' | 'INACTIVE';
  nextDueDate: string;
  billingType: string;
  description?: string;
}
