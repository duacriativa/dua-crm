import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mesma lógica do LeadQualificationService
function qualify(monthlyRevenue?: string, saleModel?: string) {
  let score = 0;
  const reasons: string[] = [];

  const revenue = (monthlyRevenue ?? '').toLowerCase();
  if (revenue.includes('150k') || revenue.includes('acima')) {
    score += 4; reasons.push('Fat. >R$150k');
  } else if (revenue.includes('100k')) {
    score += 3; reasons.push('Fat. R$100k–R$150k');
  } else if (revenue.includes('50k')) {
    score += 2; reasons.push('Fat. R$50k–R$100k');
  }

  const model = (saleModel ?? '').toLowerCase();
  if (model.includes('físic') && model.includes('online')) {
    score += 2; reasons.push('Loja física + online');
  } else if (model.includes('online')) {
    score += 1; reasons.push('Online');
  } else if (model.includes('atacado')) {
    score += 1; reasons.push('Atacado');
  }

  let qualification: 'ULTRA' | 'QUALIFIED' | 'COLD' | 'UNQUALIFIED';
  if (score >= 5) qualification = 'ULTRA';
  else if (score >= 2) qualification = 'QUALIFIED';
  else if (score >= 1) qualification = 'COLD';
  else qualification = 'COLD';

  return { score, qualification, reasons };
}

// Extrai faturamento e modelo das notas do contato
function extractFromNotes(notes?: string | null) {
  if (!notes) return { monthlyRevenue: undefined, saleModel: undefined };

  const revenueMatch = notes.match(/[Ff]aturamento[:\s]+([^\n]+)/);
  const modelMatch = notes.match(/[Mm]odelo de venda[:\s]+([^\n]+)/);

  return {
    monthlyRevenue: revenueMatch?.[1]?.trim(),
    saleModel: modelMatch?.[1]?.trim(),
  };
}

async function main() {
  const contacts = await prisma.contact.findMany({
    select: { id: true, name: true, notes: true, monthlyRevenue: true, saleModel: true, qualification: true },
  });

  console.log(`\n📊 Total de contatos: ${contacts.length}\n`);

  let ultra = 0, qualified = 0, cold = 0, skipped = 0;

  for (const contact of contacts) {
    // Usa campos diretos se existirem, senão extrai das notas
    const monthlyRevenue = contact.monthlyRevenue ?? extractFromNotes(contact.notes).monthlyRevenue;
    const saleModel = contact.saleModel ?? extractFromNotes(contact.notes).saleModel;

    // Se não tem nenhuma info de qualificação, marca como COLD
    if (!monthlyRevenue && !saleModel) {
      if (contact.qualification === 'UNQUALIFIED') {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { qualification: 'COLD', leadScore: 0 },
        });
        cold++;
        console.log(`  🔴 COLD (sem dados): ${contact.name}`);
      } else {
        skipped++;
      }
      continue;
    }

    const result = qualify(monthlyRevenue, saleModel);

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        qualification: result.qualification,
        leadScore: result.score,
        monthlyRevenue: monthlyRevenue ?? contact.monthlyRevenue,
        saleModel: saleModel ?? contact.saleModel,
      },
    });

    if (result.qualification === 'ULTRA') { ultra++; console.log(`  ⭐ ULTRA (score ${result.score}): ${contact.name} | ${result.reasons.join(', ')}`); }
    else if (result.qualification === 'QUALIFIED') { qualified++; console.log(`  🟡 QUALIFIED (score ${result.score}): ${contact.name} | ${result.reasons.join(', ')}`); }
    else { cold++; console.log(`  🔴 COLD (score ${result.score}): ${contact.name}`); }
  }

  console.log(`\n✅ Qualificação concluída!`);
  console.log(`  ⭐ Ultra: ${ultra}`);
  console.log(`  🟡 Qualificados: ${qualified}`);
  console.log(`  🔴 Frios: ${cold}`);
  console.log(`  ⏭  Já qualificados (mantidos): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
