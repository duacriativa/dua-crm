import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? '';
  if (!raw) return raw;
  // pgBouncer (Supabase pooler) requer connection_limit=1 para Prisma não esgotar o pool
  if (raw.includes('pgbouncer') && !raw.includes('connection_limit')) {
    return raw + (raw.includes('?') ? '&' : '?') + 'connection_limit=1';
  }
  return raw;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = buildDatabaseUrl();
    super({ datasources: { db: { url } } });

    const host = (process.env.DATABASE_URL ?? '').split('@')[1]?.split('/')[0] ?? 'DATABASE_URL_MISSING';
    this.logger.log(`DATABASE_URL host=${host}`);
  }

  async onModuleInit() {
    this.logger.log('Conectando ao banco...');
    try {
      await this.$connect();
      await this.$queryRaw`SELECT 1 AS ok`;
      this.logger.log('Banco OK ✓');
    } catch (e: any) {
      // NÃO relança — deixa o app subir mesmo com DB inacessível.
      // O health endpoint retorna 503/degraded e os endpoints que usam DB
      // retornam 500 com mensagem clara. Isso é melhor do que o processo morrer
      // e Railway mostrar "Application failed to respond" para TODOS os requests.
      this.logger.error(`BANCO INACESSÍVEL na inicialização: ${e.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
