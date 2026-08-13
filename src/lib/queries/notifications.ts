import { isManager } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { getBudgetsWithSpend } from "@/lib/queries/budget";
import { maybeTenantId } from "@/lib/db/tenantContext";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import {
  currentMonthString,
  dateOnlyStringToUTCDate,
  todayTashkentDateOnlyString,
  utcDateToDateOnlyString,
} from "@/lib/date";

export interface Notification {
  severity: "danger" | "warning" | "info";
  title: string;
  message: string;
  href: string;
}

/**
 * Mahsulotning o'z `minQoldiq` chegarasi bo'lmasa (0) — shu sobit qiymat
 * ishlatiladi. Ilgari BU YAGONA chegara edi: tuxum sotuvchiga ham,
 * avtomobil sotuvchiga ham 5 dona.
 */
const LOW_STOCK_DEFAULT = 5;

/**
 * Aktiv biznes bo'yicha bildirishnomalar: budjet oshishi, muddati o'tgan qarzlar,
 * kam qolgan ombor. Admin uchun to'liq; sotuvchi/kassir cheklangan.
 */
export async function getNotifications(
  businessId: string,
  opts: { rol: string; omborli: boolean; userId?: string }
): Promise<Notification[]> {
  const out: Notification[] = [];
  const month = currentMonthString();

  // Kunlik hisobot: tasdiqlanmagan O'TGAN kunlar (KUNLIK moduli yoqiq bo'lsa).
  // Direktor kechagi kunni ham tasdiqlay oladi — bu eslatma unutmaslik uchun.
  // Ko'radi: tayinlangan direktor (roli muhim emas) va boshqaruvchilar.
  const tenantId = maybeTenantId();
  if (tenantId && (await isModuleOnForTenant(tenantId, "KUNLIK"))) {
    const sozlama = await prisma.dailyReportSetting.findFirst({
      where: { businessId },
      select: { direktorId: true },
    });
    const direktormi = !!opts.userId && sozlama?.direktorId === opts.userId;
    if (direktormi || isManager(opts.rol)) {
      const bugun = dateOnlyStringToUTCDate(todayTashkentDateOnlyString());
      const ochiqlar = await prisma.dailyReport.findMany({
        where: { businessId, holat: { not: "CONFIRMED" }, jamiSumma: { gt: 0 }, sana: { lt: bugun } },
        orderBy: { sana: "desc" },
        select: { sana: true, jamiSumma: true },
        take: 10,
      });
      if (ochiqlar.length > 0) {
        const oxirgi = utcDateToDateOnlyString(ochiqlar[0].sana);
        out.push({
          severity: "warning",
          title: "Kunlik yakun tasdiqlanmagan",
          message:
            ochiqlar.length === 1
              ? `${oxirgi.split("-").reverse().join(".")} kuni (${ochiqlar[0].jamiSumma.toLocaleString("ru-RU")} so'm) tasdiqlanishini kutmoqda`
              : `${ochiqlar.length} ta kun tasdiqlanishini kutmoqda (oxirgisi ${oxirgi.split("-").reverse().join(".")})`,
          href: `/app/kunlik?sana=${oxirgi}`,
        });
      }
    }
  }

  // Budjet oshishi (faqat admin)
  if (isManager(opts.rol)) {
    const budgets = await getBudgetsWithSpend(businessId, month);
    for (const b of budgets) {
      if (b.limitSumma > 0 && b.sarflangan > b.limitSumma) {
        out.push({
          severity: "danger",
          title: "Budjet oshib ketdi",
          message: `"${b.nomi}" bo'yicha limit ${b.foiz}% ga yetdi`,
          href: "/app/byudjet",
        });
      } else if (b.foiz >= 80 && b.foiz < 100) {
        out.push({
          severity: "warning",
          title: "Budjet chegarasiga yaqin",
          message: `"${b.nomi}" — ${b.foiz}%`,
          href: "/app/byudjet",
        });
      }
    }
  }

  // Ombor: kam qolgan / tugagan (omborli biznes)
  if (opts.omborli) {
    // Har mahsulotning O'Z chegarasi bor; qo'yilmagan bo'lsa (0) — default.
    const mahsulotlar = await prisma.product.findMany({
      where: { businessId, isActive: true },
      select: { nomi: true, miqdor: true, minQoldiq: true, birlik: true },
      orderBy: { miqdor: "asc" },
      take: 200,
    });
    const low = mahsulotlar.filter(
      (p) => p.miqdor <= (p.minQoldiq > 0 ? p.minQoldiq : LOW_STOCK_DEFAULT)
    );
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
        message:
          lowOnly.length === 1
            ? `"${lowOnly[0].nomi}" — ${lowOnly[0].miqdor} ${lowOnly[0].birlik} qoldi`
            : `${lowOnly.length} ta mahsulot minimal qoldiqdan kam`,
        href: isManager(opts.rol) ? "/app/ombor" : "/app/sotuv",
      });
    }
  }

  // Muddati o'tgan qarzlar (omborli biznes) — 30+ kun (faqat bizga qarzdorlar)
  if (opts.omborli) {
    const debts = await prisma.debt.findMany({
      where: { businessId, isYopilgan: false, turi: "olinadigan" },
      select: { mijozNomi: true, jamiSumma: true, tolangan: true, createdAt: true },
    });
    const now = Date.now();
    const overdue = debts.filter((d) => (now - d.createdAt.getTime()) / 86_400_000 > 30);
    const old90 = overdue.filter((d) => (now - d.createdAt.getTime()) / 86_400_000 > 90);
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
    const mening = await prisma.debt.findMany({
      where: { businessId, isYopilgan: false, turi: "beriladigan", muddat: { lt: new Date() } },
      select: { jamiSumma: true, tolangan: true },
    });
    if (mening.length > 0) {
      const total = mening.reduce((a, d) => a + (d.jamiSumma - d.tolangan), 0);
      out.push({
        severity: "danger",
        title: "To'lash muddati o'tdi",
        message: `${mening.length} ta qarzingiz kechikdi, jami ${total.toLocaleString("ru-RU")} so'm`,
        href: "/app/qarzlar",
      });
    }

    // Shartnoma muddati (HUJJATLAR moduli). Modul yoqilmagan bo'lsa jadval
    // bo'sh bo'ladi va bu blok hech narsa qo'shmaydi — qo'shimcha guard shart emas.
    const { muddatiYaqinShartnomalar } = await import("@/lib/queries/hujjat");
    const shartnomalar = await muddatiYaqinShartnomalar(businessId);
    const otgan = shartnomalar.filter((c) => c.kunQoldi < 0);
    if (otgan.length > 0) {
      out.push({
        severity: "danger",
        title: "Shartnoma muddati o'tdi",
        message: `${otgan[0].raqam} — ${otgan[0].nomi}${otgan.length > 1 ? ` va yana ${otgan.length - 1} ta` : ""}`,
        href: "/app/hujjatlar",
      });
    }
    const yaqin = shartnomalar.filter((c) => c.kunQoldi >= 0);
    if (yaqin.length > 0) {
      out.push({
        severity: "warning",
        title: "Shartnoma muddati yaqinlashdi",
        message: `${yaqin[0].raqam} — ${yaqin[0].kunQoldi} kun qoldi${yaqin.length > 1 ? `, yana ${yaqin.length - 1} ta shartnoma` : ""}`,
        href: "/app/hujjatlar",
      });
    }
  }

  return out;
}

/** Bildirishnomalar sonini tez hisoblaydi (nav badge uchun). */
export async function getNotificationCount(
  businessId: string,
  opts: { rol: string; omborli: boolean; userId?: string }
): Promise<number> {
  return (await getNotifications(businessId, opts)).length;
}
