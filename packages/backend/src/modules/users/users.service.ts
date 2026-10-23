import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const exists = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado neste tenant.');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role ?? 'AGENT',
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return user;
  }

  async getSignatures(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { signatures: true, signature: true },
    });
    return { signatures: user?.signatures ?? [], signature: user?.signature ?? '' };
  }

  async saveSignatures(userId: string, signatures: string[], signature?: string) {
    const list = [...new Set((Array.isArray(signatures) ? signatures : [])
      .filter((s) => typeof s === 'string')
      .map((s) => s.trim())
      .filter(Boolean))].slice(0, 50);
    const current = signature && list.includes(signature) ? signature : null;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { signatures: list, signature: current },
      select: { signatures: true, signature: true },
    });
    return { signatures: user.signatures, signature: user.signature ?? '' };
  }
}
