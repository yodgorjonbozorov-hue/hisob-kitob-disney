import { prisma } from "@/lib/prisma";
import { currentMonthString } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";
import { runBusinessTx } from "@/lib/db/businessTx";
import { kunlikQulfHolati, qulfSanasi } from "@/lib/services/davrQulfi";

/**
 * Muddati kelgan takroriy tranzaksiyalarni yaratadi. Har oy `kun` sanasi kelganda
 * (va shu oyda hali yaratilmagan bo'lsa) bitta tranzaksiya yaratadi.
 * Idempotent: `lastGenerated` = joriy oy bo'lsa o'tkazib yuboriladi.
 *
 * YOPILGAN DAVR (audit: Critical #4). Takroriy yozuvning sanasi joriy oyning
 * `kun` i — u tasdiqlangan (yopilgan) kunga tushib qolishi mumkin (masalan
 * cron bir necha kun ishlamay qolgan va oradagi kunlar yopilgan). Bunday
 * yozuv jimgina yozilib ketsa, tasdiqlangan hisobot raqamlari bilan Yozuvlar
 * bir-biriga mos kelmay qoladi.
 *
 * Shuning uchun:
 *  - qulflangan kun O'TKAZIB YUBORILADI (xato tashlanmaydi — bu kutilgan
 *    holat, cron yiqilmasligi kerak);
 *  - `lastGenerated` ATAYLAB belgilanmaydi: kun qayta ochilsa keyingi
 *    yurishda yozuv o'z-o'zidan yaratiladi va oy yo'qolmaydi;
 *  - o'tkazib yuborilgani log'ga ham, AUDIT jurnaliga ham tushadi
 *    ("nega bu oy ijara yozilmagan?" degan savolga javob qoladi);
 *  - qolgan takroriy yozuvlar odatdagidek davom etadi.
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
  /** Yopilgan kunga tushgani uchun o'tkazib yuborilganlar soni. */
  let otkazildi = 0;
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

    // Yopilgan davr: yozuv yaratilmaydi, sabab jurnalga tushadi va aylanish
    // DAVOM ETADI (bitta qulflangan yozuv qolganlarini to'xtatmasin).
    const qulf = await kunlikQulfHolati(r.businessId, sana);
    if (qulf) {
      const kun = qulfSanasi(qulf);
      console.warn(
        `Takroriy yozuv o'tkazib yuborildi: ${kun} kunlik hisoboti tasdiqlangan ` +
          `(andoza: ${r.id}, ${r.turi}, ${r.summa}). Kun qayta ochilsa keyingi yurishda yoziladi.`
      );
      await logAudit({
        businessId: r.businessId,
        userId: admin.id,
        userIsm: admin.ism,
        action: "skip",
        entity: "recurringTransaction",
        entityId: r.id,
        after: {
          sabab: `${kun} kunlik hisoboti tasdiqlangan (yopilgan)`,
          sana: kun,
          summa: r.summa,
          turi: r.turi,
          takroriy: true,
        },
      });
      otkazildi++;
      continue;
    }

    // Bitta andozadagi kutilmagan xato ham qolganlarini to'xtatmasin:
    // cron 50+ tenant bo'ylab aylanadi, bittasi tufayli hammasi xizmatsiz
    // qolmasligi kerak (`lib/cron/ishlar.ts` dagi `tenantlarBoylab` uslubi).
    try {
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
    } catch (error) {
      console.error(`Takroriy yozuv xatosi (andoza: ${r.id}):`, error);
    }
  }

  if (otkazildi > 0) {
    console.warn(`Takroriy yozuvlar: ${otkazildi} ta yopilgan kunga tushgani uchun o'tkazib yuborildi.`);
  }
  return count;
}
