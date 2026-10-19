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
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Refresh token é um JWT: o bcrypt só olha os primeiros 72 bytes, que são iguais
// em todos os tokens do mesmo usuário. Por isso guardamos SHA-256 do token inteiro.
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.log(`[login] email=${dto.email}`);

    let user: { id: string; tenantId: string; role: string; active: boolean; passwordHash: string } | null;
    try {
      user = await this.prisma.user.findFirst({
        where: { email: dto.email },
        select: { id: true, tenantId: true, role: true, active: true, passwordHash: true },
      });
      this.logger.log(`[login] user_found=${!!user} active=${user?.active ?? 'n/a'}`);
    } catch (e: any) {
      this.logger.error(`[login] DB erro: ${e.message}`);
      throw new InternalServerErrorException(`Falha ao buscar usuario: ${e.message}`);
    }

    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    let valid: boolean;
    try {
      valid = await bcrypt.compare(dto.password, user.passwordHash);
      this.logger.log(`[login] senha_valida=${valid}`);
    } catch (e: any) {
      this.logger.error(`[login] bcrypt erro: ${e.message}`);
      throw new InternalServerErrorException(`Falha na verificacao de senha: ${e.message}`);
    }

    if (!valid) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const payload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET') ?? process.env.JWT_ACCESS_SECRET;
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET') ?? process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || !refreshSecret) {
      this.logger.error('[login] JWT secrets ausentes');
      throw new InternalServerErrorException('JWT secrets nao configurados.');
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

    try {
      await this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashRefreshToken(refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        },
      });
    } catch (e: any) {
      this.logger.error(`[login] refreshToken.create falhou: ${e.message}`);
      throw new InternalServerErrorException('Falha ao registrar sessao.');
    }

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterTenantDto) {
    const slug = dto.brandName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const exists = await this.prisma.tenant.findUnique({ where: { slug } });
    if (exists) throw new ConflictException('Essa marca ja esta cadastrada.');

    const emailInUse = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (emailInUse) throw new ConflictException('E-mail ja cadastrado.');

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

  async refresh(rawRefreshToken: string) {
    let payload: { sub: string; tenantId: string; role: string };
    try {
      payload = this.jwt.verify(rawRefreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalido.');
    }

    const now = new Date();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(rawRefreshToken) },
    });

    let sessionId: string;
    if (stored) {
      if (stored.userId !== payload.sub) {
        throw new UnauthorizedException('Refresh token invalido.');
      }
      if (stored.revokedAt) {
        // Token já usado sendo apresentado de novo: possível roubo. Encerra tudo do usuário.
        this.logger.warn(`[refresh] reuso de refresh token user=${payload.sub}`);
        await this.prisma.refreshToken.updateMany({
          where: { userId: payload.sub, revokedAt: null },
          data: { revokedAt: now },
        });
        throw new UnauthorizedException('Token invalido. Sessao encerrada por seguranca.');
      }
      if (stored.expiresAt <= now) {
        throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
      }
      sessionId = stored.id;
    } else {
      // Transição: sessões criadas antes do SHA-256 estão em bcrypt. Aceita uma vez
      // e a rotação abaixo já grava o novo token em SHA-256.
      const legacy = await this.findLegacySession(payload.sub, rawRefreshToken, now);
      if (!legacy) throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
      sessionId = legacy;
    }

    // Revoga só esta sessão; se outra requisição já a consumiu, não rotaciona de novo.
    const consumed = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
    if (consumed.count !== 1) {
      throw new UnauthorizedException('Sessao expirada. Faca login novamente.');
    }

    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '8h';
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const newPayload = { sub: payload.sub, tenantId: payload.tenantId, role: payload.role };
    const accessToken = this.jwt.sign(newPayload, { secret: accessSecret, expiresIn: accessExpiresIn });
    const newRefreshToken = this.jwt.sign(newPayload, { secret: refreshSecret, expiresIn: refreshExpiresIn });

    // Grava antes de responder: o próximo refresh precisa encontrar este token
    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: hashRefreshToken(newRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  // Procura uma sessão ativa antiga (hash bcrypt) do usuário que aceite o token.
  // Remover quando não houver mais linhas com tokenHash começando por '$2'.
  private async findLegacySession(userId: string, rawToken: string, now: Date): Promise<string | null> {
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now }, tokenHash: { startsWith: '$2' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, tokenHash: true },
    });
    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) return c.id;
    }
    return null;
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

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
