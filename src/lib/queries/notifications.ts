import { perRequestCache } from "@/lib/perRequestCache";
import { isManager } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { currentMonthString, monthRangeUTC } from "@/lib/date";

export interface Notification {
  severity: "danger" | "warning" | "info";
  title: string;
  message: string;
  href: string;
}

const LOW_STOCK = 5; // shu va undan kam qoldiq — "kam qoldi"
const KUN_MS = 86_400_000;

/**
 * Budjet ogohlantirishlari. Bildirishnomalar uchun faqat LIMIT QO'YILGAN kategoriyalar
 * muhim, shuning uchun (budjet sahifasidagi `getBudgetsWithSpend`dan farqli) barcha
 * chiqim kategoriyalari ro'yxati tortilmaydi — nomi Budget->Category bog'lanishidan keladi.
 * 3 ta so'rov o'rniga 2 ta.
 */
async function budjetOgohlantirishlari(businessId: string, month: string): Promise<Notification[]> {
  const { from, to } = monthRangeUTC(month);
  const [budgets, spends] = await Promise.all([
    prisma.budget.findMany({
      where: { businessId, oy: month, limitSumma: { gt: 0 } },
      select: { categoryId: true, limitSumma: true, category: { select: { nomi: true } } },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { businessId, turi: "chiqim", deletedAt: null, sana: { gte: from, lt: to } },
      _sum: { summa: true },
    }),
  ]);

  const spendMap = new Map(spends.map((s) => [s.categoryId, s._sum.summa ?? 0]));
  const out: Notification[] = [];
  for (const b of budgets) {
    const sarflangan = spendMap.get(b.categoryId) ?? 0;
    const foiz = Math.round((sarflangan / b.limitSumma) * 100);
    if (sarflangan > b.limitSumma) {
      out.push({
        severity: "danger",
        title: "Budjet oshib ketdi",
        message: `"${b.category.nomi}" bo'yicha limit ${foiz}% ga yetdi`,
        href: "/app/byudjet",
      });
    } else if (foiz >= 80 && foiz < 100) {
      out.push({
        severity: "warning",
        title: "Budjet chegarasiga yaqin",
        message: `"${b.category.nomi}" — ${foiz}%`,
        href: "/app/byudjet",
      });
    }
  }
  return out;
}

/**
 * Aktiv biznes bo'yicha bildirishnomalar: budjet oshishi, muddati o'tgan qarzlar,
 * kam qolgan ombor. Admin uchun to'liq; sotuvchi/kassir cheklangan.
 *
 * TEZLIK: barcha bo'limlar parallel bajariladi va qatorlar bazada filtrlanadi
 * (avval ochiq qarzlarning HAMMASI tortilib, JS'da sanaladi edi).
 */
export const getNotifications = perRequestCache(async function getNotifications(
  businessId: string,
  rol: string,
  omborli: boolean
): Promise<Notification[]> {
  const opts = { rol, omborli };
  const month = currentMonthString();
  const now = Date.now();
  const kun30 = new Date(now - 30 * KUN_MS);
  const kun90 = new Date(now - 90 * KUN_MS);

  const [budjet, low, overdue, mening] = await Promise.all([
    isManager(opts.rol) ? budjetOgohlantirishlari(businessId, month) : Promise.resolve([]),
    opts.omborli
      ? prisma.product.findMany({
          where: { businessId, isActive: true, miqdor: { lte: LOW_STOCK } },
          select: { nomi: true, miqdor: true },
          orderBy: { miqdor: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
    // 30+ kunlik qarzlar — chegarani baza qo'yadi, hamma ochiq qarz tortilmaydi.
    opts.omborli
      ? prisma.debt.findMany({
          where: {
            businessId,
            isYopilgan: false,
            turi: "olinadigan",
            createdAt: { lt: kun30 },
          },
          select: { jamiSumma: true, tolangan: true, createdAt: true },
        })
      : Promise.resolve([]),
    opts.omborli
      ? prisma.debt.findMany({
          where: { businessId, isYopilgan: false, turi: "beriladigan", muddat: { lt: new Date() } },
          select: { jamiSumma: true, tolangan: true },
        })
      : Promise.resolve([]),
  ]);

  const out: Notification[] = [...budjet];

  // Ombor: kam qolgan / tugagan (omborli biznes)
  {
    const out0 = low.filter((p) => p.miqdor <= 0);
    const lowOnly = low.filter((p) => p.miqdor > 0);
    if (out0.length > 0) {
      out.push({
        severity: "danger",
        title: "Ombor tugadi",
        message: `${out0.length} ta mahsulot qolmadi: ${out0.slice(0, 3).map((p) => p.nomi).join(", ")}${out0.length > 3 ? "…" : ""}`,
        href: isManager(opts.rol) ? "/app/ombor" : "/app/sotuv",
      });
    }
    if (lowOnly.length > 0) {
      out.push({
        severity: "warning",
        title: "Ombor kam qoldi",
        message: `${lowOnly.length} ta mahsulot ${LOW_STOCK} donadan kam`,
        href: isManager(opts.rol) ? "/app/ombor" : "/app/sotuv",
      });
    }
  }

  // Muddati o'tgan qarzlar (omborli biznes) — 30+ kun (faqat bizga qarzdorlar)
  {
    const old90 = overdue.filter((d) => d.createdAt.getTime() < kun90.getTime());
    if (old90.length > 0) {
      const total = old90.reduce((a, d) => a + (d.jamiSumma - d.tolangan), 0);
      out.push({
        severity: "danger",
        title: "Uzoq muddatli qarz (90+ kun)",
        message: `${old90.length} ta mijoz, jami ${total.toLocaleString("ru-RU")} so'm`,
        href: "/app/qarzlar",
      });
    } else if (overdue.length > 0) {
      out.push({
        severity: "warning",
        title: "Muddati o'tgan qarz (30+ kun)",
        message: `${overdue.length} ta mijoz to'lovni kechiktirmoqda`,
        href: "/app/qarzlar",
      });
    }

    // O'z qarzlarim — kelishilgan muddati o'tganlari.
    if (mening.length > 0) {
      const total = mening.reduce((a, d) => a + (d.jamiSumma - d.tolangan), 0);
      out.push({
        severity: "danger",
        title: "To'lash muddati o'tdi",
        message: `${mening.length} ta qarzingiz kechikdi, jami ${total.toLocaleString("ru-RU")} so'm`,
        href: "/app/qarzlar",
      });
    }
  }

  return out;
});

/**
 * Bildirishnomalar soni (nav badge uchun). `getNotifications` React cache bilan
 * memoizatsiya qilingani uchun bildirishnomalar sahifasi bilan bitta so'rovda
 * ikki marta hisoblanmaydi.
 */
export async function getNotificationCount(
  businessId: string,
  opts: { rol: string; omborli: boolean }
): Promise<number> {
  return (await getNotifications(businessId, opts.rol, opts.omborli)).length;
}
