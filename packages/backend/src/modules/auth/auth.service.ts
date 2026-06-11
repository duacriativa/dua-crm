import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Login ────────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.log(`[login] email=${dto.email}`);

    // 1. Busca usuário
    let user: { id: string; tenantId: string; role: string; active: boolean; passwordHash: string } | null;
    try {
      user = await this.prisma.user.findFirst({
        where: { email: dto.email },
        select: { id: true, tenantId: true, role: true, active: true, passwordHash: true },
      });
      this.logger.log(`[login] user_found=${!!user} active=${user?.active ?? 'n/a'}`);
    } catch (e: any) {
      this.logger.error(`[login] DB erro: ${e.message}`);
      throw new InternalServerErrorException(`Falha ao buscar usuário: ${e.message}`);
    }

    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // 2. Verifica senha
    let valid: boolean;
    try {
      valid = await bcrypt.compare(dto.password, user.passwordHash);
      this.logger.log(`[login] senha_valida=${valid}`);
    } catch (e: any) {
      this.logger.error(`[login] bcrypt erro: ${e.message}`);
      throw new InternalServerErrorException(`Falha na verificação de senha: ${e.message}`);
    }

    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // 3. Gera tokens
    const payload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET') ?? process.env.JWT_ACCESS_SECRET;
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET') ?? process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || !refreshSecret) {
      this.logger.error('[login] JWT secrets ausentes');
      throw new InternalServerErrorException('JWT secrets não configurados.');
    }

    let accessToken: string;
    let refreshToken: string;
    try {
      const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '8h';
      const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
      accessToken = this.jwt.sign(payload, { secret: accessSecret, expiresIn: accessExpiresIn });
      refreshToken = this.jwt.sign(payload, { secret: refreshSecret, expiresIn: refreshExpiresIn });
      this.logger.log('[login] tokens gerados OK');
    } catch (e: any) {
      this.logger.error(`[login] JWT erro: ${e.message}`);
      throw new InternalServerErrorException(`Falha ao gerar token: ${e.message}`);
    }

    // 4. Persiste refresh token (fire-and-forget — não bloqueia login)
    bcrypt.hash(refreshToken, 10)
      .then(tokenHash =>
        this.prisma.refreshToken.create({
          data: {
            userId: user!.id,
            tokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        })
      )
      .catch((e: any) => this.logger.warn(`[login] refreshToken.create falhou (não-crítico): ${e.message}`));

    return { accessToken, refreshToken };
  }

  // ── Register ─────────────────────────────────────────────────────────────────

  async register(dto: RegisterTenantDto) {
    const slug = dto.brandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const exists = await this.prisma.tenant.findUnique({ where: { slug } });
    if (exists) throw new ConflictException('Essa marca já está cadastrada.');

    const emailInUse = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (emailInUse) throw new ConflictException('E-mail já cadastrado.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.brandName,
        slug,
        users: {
          create: { email: dto.email, name: dto.ownerName, passwordHash, role: 'OWNER' },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0];
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET') ?? process.env.JWT_ACCESS_SECRET ?? '';
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET') ?? process.env.JWT_REFRESH_SECRET ?? '';
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '8h';
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const p = { sub: user.id, tenantId: tenant.id, role: user.role };
    return {
      accessToken: this.jwt.sign(p, { secret: accessSecret, expiresIn: accessExpiresIn }),
      refreshToken: this.jwt.sign(p, { secret: refreshSecret, expiresIn: refreshExpiresIn }),
    };
  }

  // ── Refresh ──────────────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string) {
    let payload: { sub: string; tenantId: string; role: string };
    try {
      payload = this.jwt.verify(rawRefreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!stored) throw new UnauthorizedException('Sessão expirada. Faça login novamente.');

    const valid = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
    if (!valid) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token inválido. Sessão encerrada por segurança.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // Re-emite novo par de tokens com o mesmo payload
    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '8h';
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const newPayload = { sub: payload.sub, tenantId: payload.tenantId, role: payload.role };
    const accessToken = this.jwt.sign(newPayload, { secret: accessSecret, expiresIn: accessExpiresIn });
    const newRefreshToken = this.jwt.sign(newPayload, { secret: refreshSecret, expiresIn: refreshExpiresIn });

    bcrypt.hash(newRefreshToken, 10)
      .then(tokenHash =>
        this.prisma.refreshToken.create({
          data: { userId: payload.sub, tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        })
      )
      .catch((e: any) => this.logger.warn(`[refresh] refreshToken.create falhou: ${e.message}`));

    return { accessToken, refreshToken: newRefreshToken };
  }

  // ── Logout ───────────────────────────────────────────────────────────────────

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ── Diagnóstico ──────────────────────────────────────────────────────────────

  async diag() {
    const results: Record<string, any> = {};

    results.env = {
      DATABASE_URL: process.env.DATABASE_URL
        ? `SET(host=${process.env.DATABASE_URL.split('@')[1]?.split('/')[0] ?? '?'})`
        : 'MISSING',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ? `SET(len=${process.env.JWT_ACCESS_SECRET.length})` : 'MISSING',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ? `SET(len=${process.env.JWT_REFRESH_SECRET.length})` : 'MISSING',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ? `SET(len=${process.env.ENCRYPTION_KEY.length})` : 'MISSING',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      results.db_ping = 'OK';
    } catch (e: any) {
      results.db_ping = `FAIL: ${e.message}`;
    }

    try {
      results.user_count = await this.prisma.user.count();
    } catch (e: any) {
      results.user_count = `FAIL: ${e.message}`;
    }

    try {
      const secret = this.config.get<string>('JWT_ACCESS_SECRET') ?? process.env.JWT_ACCESS_SECRET ?? '';
      if (secret) {
        this.jwt.sign({ sub: 'diag' }, { secret, expiresIn: '1m' });
        results.jwt_sign = 'OK';
      } else {
        results.jwt_sign = 'FAIL: no secret';
      }
    } catch (e: any) {
      results.jwt_sign = `FAIL: ${e.message}`;
    }

    return results;
  }
}
