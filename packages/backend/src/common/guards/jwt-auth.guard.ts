import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.DISABLE_AUTH === 'true') {
      const user = await this.prisma.user.findFirst({
        where: { active: true },
        select: { id: true, tenantId: true, role: true, active: true },
        orderBy: { createdAt: 'asc' },
      });
      if (user) {
        const req = context.switchToHttp().getRequest();
        req.user = user;
        return true;
      }
    }
    return super.canActivate(context) as Promise<boolean>;
  }
}
