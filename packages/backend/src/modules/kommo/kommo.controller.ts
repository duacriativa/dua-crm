import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('kommo')
@UseGuards(JwtAuthGuard)
export class KommoController {
  constructor(private readonly prisma: PrismaService) {}

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
    const rows = await this.prisma.$queryRaw<{ status: string; count: bigint }[]>`
      SELECT status, COUNT(*) as count FROM "KommoLead" WHERE "tenantId" = ${tenantId} GROUP BY status
    `;
    const byStatus: Record<string, number> = {};
    for (const r of rows) byStatus[r.status] = Number(r.count);

    const active = byStatus['active'] ?? 0;
    const won    = byStatus['won']    ?? 0;
    const lost   = byStatus['lost']   ?? 0;
    const total  = active + won + lost;
    const closed = won + lost;
    const conversionRate = closed > 0 ? Math.round((won / closed) * 100) : 0;

    return { total, active, won, lost, conversionRate };
  }
}
