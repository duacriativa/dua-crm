// Plain JS seed — run with `node prisma/seed.js` (no ts-node needed)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const slug = 'dua-criativa';

  let tenant = await prisma.tenant.findUnique({ where: { slug } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Dua Criativa', slug, plan: 'ESCALA' },
    });
    console.log('[seed] Tenant criado:', tenant.name);
  } else {
    console.log('[seed] Tenant já existe:', tenant.name);
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
    console.log('[seed] Usuário master criado:', user.email);
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, active: true, tenantId: tenant.id },
    });
    console.log('[seed] Senha sincronizada:', email);
  }
}

main()
  .catch((e) => { console.error('[seed] ERRO:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
