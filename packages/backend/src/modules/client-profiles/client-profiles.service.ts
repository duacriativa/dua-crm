import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import type { ClientProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotifyService } from '../notifications/notify.service';
import { normalizePhone, phoneVariants } from '../../common/phone.util';
import { appUrl } from '../scheduling/scheduling.service';
import { BIRTHDAY_PATTERN } from '../sales-tasks/sales-tasks.rules';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STATUSES = ['PENDING', 'COMPLETE'];
const CLIENT_STATUSES = ['ACTIVE', 'INACTIVE'];

/** Campos que o cliente preenche no link (e que a equipe pode corrigir no CRM). */
const FIELDS = [
  ['name', 120], ['brand', 120], ['legalName', 200], ['cnpj', 20], ['cpf', 20], ['email', 200], ['emailAlt', 200],
  ['phone', 40], ['instagram', 60], ['zipCode', 12], ['street', 200], ['number', 30], ['complement', 120],
  ['neighborhood', 120], ['city', 120], ['state', 40], ['birthday', 5], ['story', 3000], ['feedback', 1500],
] as const;
type Field = (typeof FIELDS)[number][0];

const newToken = () => crypto.randomBytes(18).toString('base64url');
export const profileUrl = (token: string) => `${appUrl()}/cadastro/${token}`;

/** Texto pronto para mandar o link pelo WhatsApp. */
export function linkMessage(p: Pick<ClientProfile, 'name' | 'token'>) {
  const first = (p.name || '').trim().split(/\s+/)[0];
  return `Oi${first ? `, ${first}` : ''}! Seja muito bem-vinda(o) à Dua Criativa 💚\n\n`
    + `Para deixar tudo certinho por aqui (contrato, notas e o seu cadastro), preenche essa ficha rapidinho? Leva uns 3 minutos:\n`
    + profileUrl(p.token);
}

/** Limpa o que veio do formulário: corta tamanho, só dígitos onde é número, @ sem espaço. */
function clean(body: any): Partial<Record<Field, string | null>> {
  const out: Partial<Record<Field, string | null>> = {};
  for (const [key, max] of FIELDS) {
    if (body?.[key] === undefined) continue;
    let v = String(body[key] ?? '').trim().slice(0, max);
    if (key === 'cnpj' || key === 'cpf' || key === 'zipCode') v = v.replace(/\D/g, '');
    if (key === 'email' || key === 'emailAlt') v = v.toLowerCase();
    if (key === 'instagram') v = v.replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '').toLowerCase();
    if (key === 'state') v = v.toUpperCase();
    if (key === 'phone') v = normalizePhone(v) ?? '';
    out[key] = v || null;
  }
  return out;
}

@Injectable()
export class ClientProfilesService {
  private readonly logger = new Logger(ClientProfilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyService,
  ) {}

  // ── Página pública /cadastro/[token] ──────────────────────────────────────

  private async byToken(token: string) {
    const p = await this.prisma.clientProfile.findUnique({ where: { token: String(token) } });
    if (!p) throw new NotFoundException('Link de cadastro não encontrado.');
    return p;
  }

  /** O que a página mostra preenchido: é o link do próprio cliente. */
  async publicView(token: string) {
    const p = await this.byToken(token);
    const data: Record<string, string> = {};
    for (const [key] of FIELDS) data[key] = (p as any)[key] ?? '';
    data.phone = data.phone.replace(/^\+55/, '');
    return { status: p.status, submittedAt: p.submittedAt, data };
  }

  async submit(token: string, body: any) {
    const p = await this.byToken(token);
    const d = clean(body);
    const cnpj = d.cnpj ?? '';
    const cpf = d.cpf ?? '';

    if (!d.name || d.name.length < 2) throw new BadRequestException('Informe o nome do responsável.');
    if (!d.brand) throw new BadRequestException('Informe o nome da marca.');
    if (!d.email || !EMAIL_RE.test(d.email)) throw new BadRequestException('Informe um e-mail válido.');
    if (d.emailAlt && !EMAIL_RE.test(d.emailAlt)) throw new BadRequestException('O e-mail alternativo não parece válido.');
    if (!d.phone || d.phone.length < 12 || d.phone.length > 16) throw new BadRequestException('Informe um WhatsApp válido com DDD.');
    if (cnpj && cnpj.length !== 14) throw new BadRequestException('O CNPJ precisa ter 14 números.');
    if (cpf && cpf.length !== 11) throw new BadRequestException('O CPF precisa ter 11 números.');
    if (!cnpj && !cpf) throw new BadRequestException('Informe o CNPJ ou o CPF (vai na nota e no contrato).');
    if (!d.zipCode || d.zipCode.length !== 8) throw new BadRequestException('Informe o CEP (8 números).');
    if (!d.street || !d.number || !d.city || !d.state) throw new BadRequestException('Complete o endereço: rua, número, cidade e estado.');
    if (d.birthday && !BIRTHDAY_PATTERN.test(d.birthday)) throw new BadRequestException('Data de aniversário inválida.');

    const first = p.status !== 'COMPLETE';
    const contactId = await this.syncContact(p, d);
    const saved = await this.prisma.clientProfile.update({
      where: { id: p.id },
      data: { ...d, name: d.name, status: 'COMPLETE', submittedAt: new Date(), contactId } as Prisma.ClientProfileUncheckedUpdateInput,
    });

    if (contactId) {
      await this.prisma.activity.create({
        data: { tenantId: p.tenantId, contactId, type: 'NOTE', authorName: 'Ficha de cadastro', content: first ? '📋 Cliente preencheu a ficha de cadastro.' : '📋 Cliente atualizou a ficha de cadastro.' },
      }).catch(() => {});
    }
    this.notify.send(p.tenantId, 'client_profile', {
      title: first ? 'Ficha de cadastro preenchida' : 'Ficha de cadastro atualizada',
      body: `${saved.brand ?? saved.name} — ${saved.name}`,
      url: `/dashboard/cadastros?id=${saved.id}`,
      tag: `client-profile-${saved.id}`,
    });
    return { ok: true };
  }

  /**
   * Liga a ficha a um contato e completa o que falta nele (nunca apaga dado que a equipe já pôs).
   * Sem contato ligado: acha pelo telefone (com/sem nono dígito) ou e-mail; senão cria como cliente.
   */
  private async syncContact(p: ClientProfile, d: Partial<Record<Field, string | null>>) {
    let contact = p.contactId ? await this.prisma.contact.findUnique({ where: { id: p.contactId } }) : null;
    if (!contact && d.phone) contact = await this.prisma.contact.findFirst({ where: { tenantId: p.tenantId, phone: { in: phoneVariants(d.phone) } } });
    if (!contact && d.email) contact = await this.prisma.contact.findFirst({ where: { tenantId: p.tenantId, email: { equals: d.email, mode: 'insensitive' } } });
    // Outro cadastro já usa esse contato: não rouba o vínculo
    if (contact && contact.id !== p.contactId) {
      const taken = await this.prisma.clientProfile.findUnique({ where: { contactId: contact.id }, select: { id: true } });
      if (taken && taken.id !== p.id) return p.contactId;
    }
    const name = d.brand ? `${d.name} - ${d.brand}` : d.name!;
    if (contact) {
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: {
          type: 'CLIENT',
          clientSince: contact.clientSince ?? new Date(),
          name: !contact.name || contact.name === contact.phone ? name : undefined,
          email: contact.email ? undefined : d.email,
          phone: contact.phone ? undefined : d.phone,
          instagramHandle: contact.instagramHandle ? undefined : d.instagram,
          birthday: contact.birthday ? undefined : d.birthday,
        },
      });
      return contact.id;
    }
    const created = await this.prisma.contact.create({
      data: {
        tenantId: p.tenantId, type: 'CLIENT', clientSince: new Date(), name,
        phone: d.phone, email: d.email, instagramHandle: d.instagram, birthday: d.birthday,
      },
    }).catch((e) => { this.logger.warn(`Contato não criado para a ficha ${p.id}: ${e.message}`); return null; });
    return created?.id ?? null;
  }

  // ── Tela "Cadastros" do CRM ───────────────────────────────────────────────

  async list(tenantId: string) {
    const rows = await this.prisma.clientProfile.findMany({
      where: { tenantId },
      orderBy: [{ updatedAt: 'desc' }],
      include: { contact: { select: { id: true, name: true } } },
    });
    return rows.map((r) => ({ ...r, url: profileUrl(r.token), message: linkMessage(r) }));
  }

  /** Gera o link para um cliente novo ou para um contato que já está no CRM. */
  async create(tenantId: string, body: any) {
    const contactId = body?.contactId ? String(body.contactId) : null;
    if (contactId) {
      const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId } });
      if (!contact) throw new NotFoundException('Contato não encontrado.');
      const existing = await this.prisma.clientProfile.findUnique({ where: { contactId } });
      if (existing) return { ...existing, url: profileUrl(existing.token), message: linkMessage(existing) };
      const p = await this.prisma.clientProfile.create({
        data: { tenantId, contactId, token: newToken(), source: 'CRM', name: contact.name, email: contact.email, phone: contact.phone, instagram: contact.instagramHandle, birthday: contact.birthday },
      });
      return { ...p, url: profileUrl(p.token), message: linkMessage(p) };
    }
    const d = clean({ name: body?.name, phone: body?.phone, brand: body?.brand });
    const p = await this.prisma.clientProfile.create({
      data: { tenantId, token: newToken(), source: 'LINK', name: d.name || 'Cliente novo', brand: d.brand, phone: d.phone },
    });
    return { ...p, url: profileUrl(p.token), message: linkMessage(p) };
  }

  async update(tenantId: string, id: string, body: any) {
    const p = await this.prisma.clientProfile.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Cadastro não encontrado.');
    const data: Prisma.ClientProfileUncheckedUpdateInput = { ...clean(body) };
    if (data.name === null) delete data.name;
    if (data.birthday && !BIRTHDAY_PATTERN.test(String(data.birthday))) throw new BadRequestException('Aniversário no formato dd/mm.');
    if (body?.clientStatus !== undefined) {
      if (!CLIENT_STATUSES.includes(body.clientStatus)) throw new BadRequestException('Situação inválida.');
      data.clientStatus = body.clientStatus;
    }
    if (body?.status !== undefined) {
      if (!STATUSES.includes(body.status)) throw new BadRequestException('Status inválido.');
      data.status = body.status;
    }
    if (body?.notes !== undefined) data.notes = String(body.notes ?? '').slice(0, 3000) || null;
    if (body?.linkSent) data.linkSentAt = new Date();
    return this.prisma.clientProfile.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    const p = await this.prisma.clientProfile.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!p) throw new NotFoundException('Cadastro não encontrado.');
    await this.prisma.clientProfile.delete({ where: { id } });
    return { ok: true };
  }
}
