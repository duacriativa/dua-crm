import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔧 Corrigindo funil...\n');

  // 1. Limpar valor da Rafaela Magalhães (não é cliente)
  const rafaela = await prisma.contact.findFirst({
    where: { name: { contains: 'Rafaela Magalh', mode: 'insensitive' } },
    include: { pipelineLeads: { include: { stage: true } } },
  });

  if (rafaela) {
    for (const lead of rafaela.pipelineLeads) {
      await prisma.pipelineLead.update({
        where: { id: lead.id },
        data: { value: null, notes: null },
      });
    }
    console.log(`✅ Rafaela Magalhães — valor removido`);
  }

  // 2. Colocar Guilherme Santos (Mandi) em Fechado com R$2.500
  const guilherme = await prisma.contact.findFirst({
    where: { name: { contains: 'Guilherme Santos', mode: 'insensitive' } },
    include: { pipelineLeads: { include: { stage: { include: { pipeline: { include: { stages: true } } } } } } },
  });

  if (guilherme) {
    for (const lead of guilherme.pipelineLeads) {
      const pipeline = lead.stage.pipeline;
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

      const position = await prisma.pipelineLead.count({ where: { stageId: wonStage.id } });

      await prisma.pipelineLead.update({
        where: { id: lead.id },
        data: {
          stageId: wonStage.id,
          value: 2500,
          position,
          notes: 'Contrato fechado — R$2500/mês',
        },
      });
      console.log(`✅ Guilherme Santos (Mandi) → Fechado R$2.500/mês`);
    }
  } else {
    console.log(`⚠️  Guilherme Santos não encontrado`);
  }

  // 3. Linkar contrato Mandi ao contato Guilherme
  if (guilherme) {
    const mandiContract = await prisma.contract.findFirst({
      where: { clientName: { contains: 'Mandi', mode: 'insensitive' } },
    });
    if (mandiContract && !mandiContract.contactId) {
      await prisma.contract.update({
        where: { id: mandiContract.id },
        data: { contactId: guilherme.id },
      });
      console.log(`✅ Contrato Mandi linkado ao Guilherme Santos`);
    }
  }

  console.log('\n✨ Correção concluída!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
