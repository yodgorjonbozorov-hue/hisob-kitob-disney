import { prisma } from "@/lib/prisma";
import { currentMonthString } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";
import { runBusinessTx } from "@/lib/db/businessTx";

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

  // Tranzaksiya userId talab qiladi. AVVAL o'sha biznesning boshqaruvchisi
  // qidiriladi — ko'p bizneslik tenantda "Ijara" chiqimi boshqa biznes
  // direktoriga yozilib qolmasin. Topilmasa tenant boshqaruvchisiga tushadi.
  const bizneslar = [...new Set(due.map((r) => r.businessId))];
  const [biznesAdminlar, tenantAdmin] = await Promise.all([
    prisma.user.findMany({
      where: { rol: { in: MANAGER_ROLLAR }, isActive: true, businessId: { in: bizneslar } },
      select: { id: true, ism: true, businessId: true },
    }),
    prisma.user.findFirst({
      where: { rol: { in: MANAGER_ROLLAR }, isActive: true },
      select: { id: true, ism: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const adminByBusiness = new Map(biznesAdminlar.map((u) => [u.businessId as string, u]));
  if (!tenantAdmin && adminByBusiness.size === 0) return 0;

  let count = 0;
  for (const r of due) {
    // Kategoriya biznesi bilan mos bo'lishi kerak (dangling himoya).
    if (r.category.businessId !== r.businessId) continue;
    // Oy o'rtasida yaratilgan andoza o'sha oyning O'TIB KETGAN kuni uchun
    // darhol yozuv yaratmasin (masalan 5-kunlik "Ijara" 20-sanada qo'shildi).
    if (
      r.createdAt.getUTCFullYear() === year &&
      r.createdAt.getUTCMonth() === monthIdx &&
      r.kun < r.createdAt.getUTCDate()
    ) {
      continue;
    }
    const admin = adminByBusiness.get(r.businessId) ?? tenantAdmin;
    if (!admin) continue;

    const sana = new Date(Date.UTC(year, monthIdx, Math.min(r.kun, 28)));
    // Tranzaksiya yaratish + "yaratildi" belgisi bitta atomik amalda:
    // o'rtada uzilsa keyingi ishga tushishda takroriy yozuv paydo bo'lmasin.
    const tx = await runBusinessTx(r.businessId, async (btx) => {
      const created = await btx.transaction.create({
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
      await btx.recurringTransaction.updateMany({
        where: { id: r.id, businessId: r.businessId },
        data: { lastGenerated: month },
      });
      return created;
    });

    await logAudit({
      businessId: r.businessId, userId: admin.id, userIsm: admin.ism,
      action: "create", entity: "transaction", entityId: tx.id,
      after: { takroriy: true, summa: r.summa, turi: r.turi },
    });
    count++;
  }
  return count;
}
