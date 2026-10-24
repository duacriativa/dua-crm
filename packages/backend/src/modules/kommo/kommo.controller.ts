import { Controller, Delete, Get, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

/** Chave em AppSetting: existe = integração do Kommo desativada (webhook ignora os eventos). */
export const kommoOffKey = (tenantId: string) => `kommo-desativado:${tenantId}`;

@Controller('kommo')
@UseGuards(JwtAuthGuard)
export class KommoController {
  constructor(private readonly prisma: PrismaService) {}

  /** Ativa/desativa pelo card em Configurações → Integrações. Desativar não apaga o histórico. */
  @Get('status')
  async status(@Req() req: any) {
    const off = await this.prisma.appSetting.findUnique({ where: { key: kommoOffKey(req.user.tenantId) } });
    return { active: !off };
  }

  @Post('activate')
  async activate(@Req() req: any) {
    await this.prisma.appSetting.deleteMany({ where: { key: kommoOffKey(req.user.tenantId) } });
    return { active: true };
  }

  @Delete()
  async deactivate(@Req() req: any) {
    const key = kommoOffKey(req.user.tenantId);
    const value = new Date().toISOString();
    await this.prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    return { active: false };
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId || tenantId === 'bypass') {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: 'dua-criativa' } });
      if (!tenant) return { total: 0, active: 0, won: 0, lost: 0, conversionRate: 0 };
      return this.calcStats(tenant.id);
    }
    return this.calcStats(tenantId);
  }

  private async calcStats(tenantId: string) {
    const rows = await this.prisma.$queryRaw<{ status: string; stageName: string | null; count: bigint }[]>`
      SELECT status, "stageName", COUNT(*) as count FROM "KommoLead" WHERE "tenantId" = ${tenantId} GROUP BY status, "stageName"
    `;

    const QUALIFICACAO = ['qualificar'];
    const ATENDIMENTO  = [
      'reunião agendada', 'proposta rede social', 'proposta performance',
      'acompanhamento', 'fp0', 'fp1', 'fp2', 'fp3- break', 'fp3-break', 'pesquisa',
    ];
    const CLIENTES     = ['cadastro cliente - dua'];
    const PERDIDOS     = ['fechado-derrota'];
    const WON_STAGES   = ['fechado-vitória', 'fechado-vitoria'];

    let total = 0, entrada = 0, qualificados = 0, atendimento = 0, clientes = 0, won = 0, lost = 0;

    for (const r of rows) {
      const n = Number(r.count);
      const stage = (r.stageName ?? '').toLowerCase().trim();
      total += n;

      if (r.status === 'won' || WON_STAGES.includes(stage)) {
        won += n;
      } else if (r.status === 'lost' || PERDIDOS.includes(stage)) {
        lost += n;
      } else if (CLIENTES.includes(stage)) {
        clientes += n;
      } else if (ATENDIMENTO.includes(stage)) {
        atendimento += n;
      } else if (QUALIFICACAO.includes(stage)) {
        qualificados += n;
      } else {
        entrada += n;
      }
    }

    const closed = won + lost;
    const conversionRate = closed > 0 ? Math.round((won / closed) * 100) : 0;

    return { total, entrada, qualificados, atendimento, clientes, won, lost, conversionRate };
  }
}
