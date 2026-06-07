import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? '';
  // Supabase pgBouncer requires connection_limit=1 so Prisma doesn't exhaust the pool
  if (url.includes('pgbouncer') && !url.includes('connection_limit')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}connection_limit=1`;
  }
  return url;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: { db: { url: buildDatabaseUrl() } },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
