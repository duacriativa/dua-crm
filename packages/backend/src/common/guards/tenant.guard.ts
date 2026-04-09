import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Garante que o usuário autenticado só acessa dados do seu próprio tenant.
 * Compara o tenantId do JWT com o :tenantId da rota (quando presente)
 * ou com o tenantId de qualquer recurso acessado.
 *
 * Multi-tenancy: cada marca é completamente isolada das outras.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) return false;

    const routeTenantId = req.params?.tenantId;

    // Se a rota tem :tenantId explícito, valida contra o token
    if (routeTenantId && routeTenantId !== user.tenantId) {
      throw new ForbiddenException('Acesso negado a este tenant.');
    }

    // Injeta tenantId no request para uso nos services
    req.tenantId = user.tenantId;
    return true;
  }
}
