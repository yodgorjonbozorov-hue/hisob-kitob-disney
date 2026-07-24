import { prisma } from "@/lib/prisma";
import { getBudgetsWithSpend } from "@/lib/queries/budget";
import { currentMonthString } from "@/lib/date";

export interface Notification {
  severity: "danger" | "warning" | "info";
  title: string;
  message: string;
  href: string;
}

const LOW_STOCK = 5; // shu va undan kam qoldiq — "kam qoldi"

/**
 * Aktiv biznes bo'yicha bildirishnomalar: budjet oshishi, muddati o'tgan qarzlar,
 * kam qolgan ombor. Admin uchun to'liq; sotuvchi/kassir cheklangan.
 */
export async function getNotifications(
  businessId: string,
  opts: { rol: string; omborli: boolean }
): Promise<Notification[]> {
  const out: Notification[] = [];
  const month = currentMonthString();

  // Budjet oshishi (faqat admin)
  if (opts.rol === "admin") {
    const budgets = await getBudgetsWithSpend(businessId, month);
    for (const b of budgets) {
      if (b.limitSumma > 0 && b.sarflangan > b.limitSumma) {
        out.push({
          severity: "danger",
          title: "Budjet oshib ketdi",
          message: `"${b.nomi}" bo'yicha limit ${b.foiz}% ga yetdi`,
          href: "/byudjet",
        });
      } else if (b.foiz >= 80 && b.foiz < 100) {
        out.push({
          severity: "warning",
          title: "Budjet chegarasiga yaqin",
          message: `"${b.nomi}" — ${b.foiz}%`,
          href: "/byudjet",
        });
      }
    }
  }

  // Ombor: kam qolgan / tugagan (omborli biznes)
  if (opts.omborli) {
    const low = await prisma.product.findMany({
      where: { businessId, isActive: true, miqdor: { lte: LOW_STOCK } },
      select: { nomi: true, miqdor: true },
      orderBy: { miqdor: "asc" },
      take: 20,
    });
    const out0 = low.filter((p) => p.miqdor <= 0);
    const lowOnly = low.filter((p) => p.miqdor > 0);
    if (out0.length > 0) {
      out.push({
        severity: "danger",
        title: "Ombor tugadi",
        message: `${out0.length} ta mahsulot qolmadi: ${out0.slice(0, 3).map((p) => p.nomi).join(", ")}${out0.length > 3 ? "…" : ""}`,
        href: opts.rol === "admin" ? "/ombor" : "/sotuv",
      });
    }
    if (lowOnly.length > 0) {
      out.push({
        severity: "warning",
        title: "Ombor kam qoldi",
        message: `${lowOnly.length} ta mahsulot ${LOW_STOCK} donadan kam`,
        href: opts.rol === "admin" ? "/ombor" : "/sotuv",
      });
    }
  }

  // Muddati o'tgan qarzlar (omborli biznes) — 30+ kun
  if (opts.omborli) {
    const debts = await prisma.debt.findMany({
      where: { businessId, isYopilgan: false },
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
        href: "/qarzlar",
      });
    } else if (overdue.length > 0) {
      out.push({
        severity: "warning",
        title: "Muddati o'tgan qarz (30+ kun)",
        message: `${overdue.length} ta mijoz to'lovni kechiktirmoqda`,
        href: "/qarzlar",
      });
    }
  }

  return out;
}

/** Bildirishnomalar sonini tez hisoblaydi (nav badge uchun). */
export async function getNotificationCount(
  businessId: string,
  opts: { rol: string; omborli: boolean }
): Promise<number> {
  return (await getNotifications(businessId, opts)).length;
}
