const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const t = await prisma.tenant.findFirst({ where: { name: 'Dua Criativa' }});
  console.log('Slug:', t?.slug, 'ID:', t?.id);
  process.exit(0);
}
run();
