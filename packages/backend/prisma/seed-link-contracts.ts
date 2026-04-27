import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { contactId: null },
    select: { id: true, clientName: true, clientPhone: true, tenantId: true, monthlyValue: true },
  });

  console.log(`\n🔗 Linkando ${contracts.length} contratos sem contato...\n`);

  let linked = 0;
  let notFound = 0;

  for (const contract of contracts) {
    let contactId: string | null = null;

    // Busca por telefone
    if (contract.clientPhone) {
      const phone = contract.clientPhone.replace(/\D/g, '');
      const contact = await prisma.contact.findFirst({
        where: {
          tenantId: contract.tenantId,
          OR: [
            { phone: { contains: phone } },
            { phone: { endsWith: phone.slice(-8) } },
          ],
        },
      });
      if (contact) contactId = contact.id;
    }

    // Fallback por nome
    if (!contactId && contract.clientName) {
      const namePart = contract.clientName.split(' ')[0]
        .replace(/[^a-zA-ZÀ-ú]/g, '').toLowerCase();
      if (namePart.length >= 3) {
        const contact = await prisma.contact.findFirst({
          where: {
            tenantId: contract.tenantId,
            name: { contains: namePart, mode: 'insensitive' },
          },
        });
        if (contact) contactId = contact.id;
      }
    }

    if (contactId) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { contactId },
      });

      // Mover lead para Fechado em todos os funis
      const pipelines = await prisma.pipeline.findMany({
        where: { tenantId: contract.tenantId },
        include: { stages: true },
      });

      for (const pipeline of pipelines) {
        const pipelineLead = await prisma.pipelineLead.findFirst({
          where: { contactId, stage: { pipelineId: pipeline.id } },
          include: { stage: true },
        });

        if (!pipelineLead || pipelineLead.stage.name === 'Fechado') continue;

        let wonStage = pipeline.stages.find((s) => s.name === 'Fechado');
        if (!wonStage) {
          wonStage = await prisma.pipelineStage.create({
            data: {
              pipelineId: pipeline.id,
              name: 'Fechado',
              color: '#10B981',
              position: pipeline.stages.length,
            },
          });
        }

        const position = await prisma.pipelineLead.count({
          where: { stageId: wonStage.id },
        });

        await prisma.pipelineLead.update({
          where: { id: pipelineLead.id },
          data: {
            stageId: wonStage.id,
            value: contract.monthlyValue,
            position,
            notes: `Contrato fechado — R$${contract.monthlyValue}/mês`,
          },
        });

        console.log(`  ✅ ${contract.clientName} → Fechado (R$${contract.monthlyValue}/mês)`);
      }

      linked++;
    } else {
      console.log(`  ⏭  Sem contato no funil: ${contract.clientName}`);
      notFound++;
    }
  }

  console.log(`\nPronto! ${linked} contratos linkados, ${notFound} sem contato no funil.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
