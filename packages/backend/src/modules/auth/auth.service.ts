import {
  Injectable,
  UnauthorizedException,
  ConflictException,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterTenantDto) {
    const slug = dto.brandName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const exists = await this.prisma.tenant.findUnique({ where: { slug } });
    if (exists) throw new ConflictException('Essa marca já está cadastrada.');

    const emailInUse = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (emailInUse) throw new ConflictException('E-mail já cadastrado.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.brandName,
        slug,
        users: {
          create: {
            email: dto.email,
            name: dto.ownerName,
            passwordHash,
            role: 'OWNER',
          },
        },
      },
      include: { users: true },
    });

    const user = tenant.users[0];
    return this.issueTokens(user.id, tenant.id, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user || !user.active) throw new UnauthorizedException('Credenciais inválidas.');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas.');

    return this.issueTokens(user.id, user.tenantId, user.role);
  }

  async refresh(rawRefreshToken: string) {
    let payload: { sub: string; tenantId: string; role: string };
    try {
      payload = this.jwt.verify(rawRefreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    // Valida hash do refresh token no banco (rotation pattern)
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) throw new UnauthorizedException('Sessão expirada. Faça login novamente.');

    const valid = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
    if (!valid) {
      // Token reuse detectado — revogar todos os tokens do usuário
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Token inválido. Sessão encerrada por segurança.');
    }

    // Revogar token usado e emitir novo par
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(payload.sub, payload.tenantId, payload.role);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, tenantId: string, role: string) {
    const payload = { sub: userId, tenantId, role };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
