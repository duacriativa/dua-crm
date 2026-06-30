import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.DISABLE_AUTH === 'true') {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 'bypass', tenantId: 'bypass', role: 'OWNER', active: true };
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }
}
