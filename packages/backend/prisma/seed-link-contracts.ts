import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, clientName: true, clientPhone: true, tenantId: true, monthlyValue: true, contactId: true },
  });

  console.log(`\n🔗 Processando ${contracts.length} contratos ativos...\n`);

  let linked = 0;
  let updated = 0;
  let notFound = 0;

  for (const contract of contracts) {
    let contactId = contract.contactId;

    // Busca contato pelo telefone se ainda não linkado
    if (!contactId && contract.clientPhone) {
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
      if (contact) {
        contactId = contact.id;
        await prisma.contract.update({ where: { id: contract.id }, data: { contactId } });
        linked++;
      }
    }

    if (!contactId) {
      notFound++;
      continue;
    }

    // Mover/atualizar lead no funil
    const pipelines = await prisma.pipeline.findMany({
      where: { tenantId: contract.tenantId },
      include: { stages: true },
    });

    for (const pipeline of pipelines) {
      const pipelineLead = await prisma.pipelineLead.findFirst({
        where: { contactId, stage: { pipelineId: pipeline.id } },
        include: { stage: true },
      });

      if (!pipelineLead) continue;

      // Busca ou cria estágio "Fechado"
      let wonStage = pipeline.stages.find((s) => s.name === 'Fechado');
      if (!wonStage) {
        wonStage = await prisma.pipelineStage.create({
          data: { pipelineId: pipeline.id, name: 'Fechado', color: '#10B981', position: pipeline.stages.length },
        });
      }

      // Move para Fechado e atualiza valor
      await prisma.pipelineLead.update({
        where: { id: pipelineLead.id },
        data: {
          stageId: wonStage.id,
          value: contract.monthlyValue,
          notes: `Contrato fechado — R$${contract.monthlyValue}/mês`,
        },
      });

      console.log(`  ✅ ${contract.clientName} → Fechado R$${contract.monthlyValue}/mês`);
      updated++;
    }
  }

  // Limpar Rafaela e outros leads SEM contrato linkado que estão em Fechado com nota de contrato
  console.log(`\n🧹 Limpando leads incorretos em Fechado...`);
  const wrongClosed = await prisma.pipelineLead.findMany({
    where: {
      stage: { name: 'Fechado' },
      notes: { contains: 'Contrato fechado' },
      contact: { contracts: { none: {} } },
    },
    include: {
      contact: { select: { name: true } },
      stage: { select: { pipelineId: true } },
    },
  });

  for (const lead of wrongClosed) {
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: lead.stage.pipelineId },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    const firstStage = pipeline?.stages[0];
    if (firstStage) {
      await prisma.pipelineLead.update({
        where: { id: lead.id },
        data: { stageId: firstStage.id, value: null, notes: null },
      });
      console.log(`  🔄 ${lead.contact?.name} — movido de volta (sem contrato real)`);
    }
  }

  console.log(`\n✅ Pronto! Linkados: ${linked} | Atualizados: ${updated} | Sem match: ${notFound}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
