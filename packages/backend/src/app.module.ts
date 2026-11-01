import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { WhatsAppCloudModule } from './modules/whatsapp-cloud/whatsapp-cloud.module';
import { InstagramModule } from './modules/instagram/instagram.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { UsersModule } from './modules/users/users.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { LeadsModule } from './modules/leads/leads.module';
import { FinancialModule } from './modules/financial/financial.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { ServicesModule } from './modules/services/services.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { KommoModule } from './modules/kommo/kommo.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { MetaAdsModule } from './modules/meta-ads/meta-ads.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PlanOrdersModule } from './modules/plan-orders/plan-orders.module';
import { SalesTasksModule } from './modules/sales-tasks/sales-tasks.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    // ── Configuração de env ─────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Rate limiting global: 100 req / 60s por IP ──────────────────────────
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    PrismaModule,
    AuthModule,
    TenantsModule,
    ContactsModule,
    ConversationsModule,
    WhatsAppCloudModule,
    InstagramModule,
    AutomationsModule,
    CampaignsModule,
    IntegrationsModule,
    UsersModule,
    PipelinesModule,
    WebhooksModule,
    LeadsModule,
    FinancialModule,
    ContractsModule,
    ServicesModule,
    NotificationsModule,
    KommoModule,
    SchedulingModule,
    MetaAdsModule,
    DashboardModule,
    PlanOrdersModule,
    SalesTasksModule,
    EventEmitterModule.forRoot(),
  ],
  providers: [
    // Rate limiting aplicado globalmente
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
