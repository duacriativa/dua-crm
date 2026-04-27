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

    // Fallback por nome — mais rigoroso, precisa de 2+ palavras
    if (!contactId && contract.clientName) {
      const nameParts = contract.clientName
        .replace(/@\S+/g, '') // remove @ handles
        .trim()
        .split(/\s+/)
        .filter(p => p.length >= 3);

      // Só busca por nome se tiver pelo menos 2 palavras significativas
      if (nameParts.length >= 2) {
        const firstTwo = nameParts.slice(0, 2).join(' ');
        const contact = await prisma.contact.findFirst({
          where: {
            tenantId: contract.tenantId,
            name: { contains: firstTwo, mode: 'insensitive' },
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

        if (!pipelineLead) continue;

        // Se já está fechado, só atualiza o valor
        if (pipelineLead.stage.name === 'Fechado') {
          await prisma.pipelineLead.update({
            where: { id: pipelineLead.id },
            data: {
              value: contract.monthlyValue,
              notes: `Contrato fechado — R$${contract.monthlyValue}/mês`,
            },
          });
          console.log(`  💰 Valor atualizado: ${contract.clientName} → R$${contract.monthlyValue}/mês`);
          continue;
        }

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

  // Limpar leads incorretamente fechados (sem contrato real)
  console.log(`\n🧹 Verificando leads fechados sem contrato...`);
  const wrongClosed = await prisma.pipelineLead.findMany({
    where: {
      stage: { name: 'Fechado' },
      notes: { contains: 'Contrato fechado' },
    },
    include: {
      contact: {
        select: {
          id: true, name: true,
          contracts: { select: { id: true } },
        },
      },
      stage: { select: { pipelineId: true } },
    },
  });

  for (const lead of wrongClosed) {
    if (!lead.contact?.contracts?.length) {
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
        console.log(`  🔄 ${lead.contact?.name} — removido de Fechado (sem contrato)`);
      }
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// Função extra: remove leads incorretamente marcados como Fechado
async function cleanupWrongClosed(prismaClient: PrismaClient) {
  // Busca leads em estágio "Fechado" que NÃO têm contrato linkado
  const closedLeads = await prismaClient.pipelineLead.findMany({
    where: {
      stage: { name: 'Fechado' },
      notes: { contains: 'Contrato fechado' },
    },
    include: {
      contact: { select: { id: true, name: true, contracts: { select: { id: true } } } },
      stage: true,
    },
  });

  for (const lead of closedLeads) {
    if (!lead.contact?.contracts?.length) {
      // Sem contrato — move de volta para "Novo Cadastro"
      const pipeline = await prismaClient.pipeline.findFirst({
        where: { stages: { some: { id: lead.stageId } } },
        include: { stages: true },
      });
      const newStage = pipeline?.stages.find(s => s.name === 'Novo Cadastro' || s.name === 'Preencheu Formulário');
      if (newStage) {
        await prismaClient.pipelineLead.update({
          where: { id: lead.id },
          data: { stageId: newStage.id, value: null, notes: null },
        });
        console.log(`  🔄 Corrigido: ${lead.contact?.name} — movido de volta para ${newStage.name}`);
      }
    }
  }
}
