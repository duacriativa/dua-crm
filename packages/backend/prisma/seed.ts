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
  const existing = await prisma.user.findFirst({ where: { email } });

  if (!existing) {
    const passwordHash = await bcrypt.hash('d@Niel0p9o8i', 12);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name: 'Daniel Guedes',
        passwordHash,
        role: 'OWNER',
      },
    });
    console.log('Usuário master criado:', user.email);
  } else {
    console.log('Usuário já existe:', email);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
