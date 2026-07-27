import { prisma } from "@/lib/prisma";
import { currentMonthString } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";

/**
 * Muddati kelgan takroriy tranzaksiyalarni yaratadi. Har oy `kun` sanasi kelganda
 * (va shu oyda hali yaratilmagan bo'lsa) bitta tranzaksiya yaratadi.
 * Idempotent: `lastGenerated` = joriy oy bo'lsa o'tkazib yuboriladi.
 */
export async function generateDueRecurring(now: Date = new Date()): Promise<number> {
  const month = currentMonthString();
  const year = now.getUTCFullYear();
  const monthIdx = now.getUTCMonth();
  const day = now.getUTCDate();

  const due = await prisma.recurringTransaction.findMany({
    // Aniq null-xavfsiz: lastGenerated null YOKI joriy oydan farqli.
    where: {
      isActive: true,
      kun: { lte: day },
      OR: [{ lastGenerated: null }, { lastGenerated: { not: month } }],
    },
    include: { category: { select: { businessId: true } } },
  });
  if (due.length === 0) return 0;

  // Tranzaksiya userId talab qiladi — tenant boshqaruvchisi (OWNER/ADMIN).
  const admin = await prisma.user.findFirst({ where: { rol: { in: MANAGER_ROLLAR } }, select: { id: true, ism: true } });
  if (!admin) return 0;

  let count = 0;
  for (const r of due) {
    // Kategoriya biznesi bilan mos bo'lishi kerak (dangling himoya).
    if (r.category.businessId !== r.businessId) continue;
    const sana = new Date(Date.UTC(year, monthIdx, Math.min(r.kun, 28)));
    const tx = await prisma.transaction.create({
      data: {
        turi: r.turi,
        categoryId: r.categoryId,
        businessId: r.businessId,
        summa: r.summa,
        sana,
        izoh: r.izoh ? `[Takroriy] ${r.izoh}` : "[Takroriy]",
        userId: admin.id,
      },
    });
    await prisma.recurringTransaction.update({ where: { id: r.id }, data: { lastGenerated: month } });
    await logAudit({
      businessId: r.businessId, userId: admin.id, userIsm: admin.ism,
      action: "create", entity: "transaction", entityId: tx.id,
      after: { takroriy: true, summa: r.summa, turi: r.turi },
    });
    count++;
  }
  return count;
}
