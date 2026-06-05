import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const slug = 'dua-criativa';

  let tenant = await prisma.tenant.findUnique({ where: { slug } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Dua Criativa',
        slug,
        plan: 'ESCALA',
      },
    });
    console.log('Tenant criado:', tenant.name);
  } else {
    console.log('Tenant já existe:', tenant.name);
  }

  const email = 'suporte@duacriativa.com';
  const passwordHash = await bcrypt.hash('d@Niel0p9o8i', 12);
  const existing = await prisma.user.findFirst({ where: { email } });

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: 'Daniel Guedes',
        passwordHash,
        role: 'OWNER',
        active: true,
      },
    });
    console.log('Usuário master criado:', user.email);
  } else {
    // Sempre atualiza a senha e garante active=true
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, active: true, tenantId: tenant.id },
    });
    console.log('Usuário já existe — senha sincronizada:', email);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
