const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tenants = await prisma.tenant.findMany();
  console.log('Tenants:', tenants);
}
main().finally(() => prisma.$disconnect());
