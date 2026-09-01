import { prisma } from "@/lib/prisma";

/**
 * ZAKAZ TO'LOV HOLATI — "puli kelgan sotuv" (FULLY PAID) yagona hisobi.
 *
 * NEGA ALOHIDA MODUL. "Yutilgan zakaz" va "puli kelgan zakaz" IKKI BOSHQA
 * narsa: qarzga yopilgan zakaz yutilgan hisoblanadi, lekin pul hali
 * kelmagan. Sotuvchi bonusi FAQAT kelgan pulga bog'lanadi, shuning uchun
 * bu hisob bitta joyda turadi va KPI ham, reyting ham, bonus ham shundan
 * o'qiydi (ikkinchi haqiqat manbai bo'lmasin).
 *
 * HISOB QOIDASI (hech qanday yangi hisoblagich SAQLANMAYDI):
 *   1. Zakazga kirim yozilmagan (`Deal.transactionId` null) yoki yozuv
 *      yumshoq o'chirilgan → to'langan 0, holat "TOLANMAGAN".
 *   2. Kirim yozilgan va to'lov turi "qarz" EMAS (naqd/click/eski null) →
 *      pul kassaga tushgan: to'langan = tranzaksiya summasi, "TOLIQ".
 *   3. To'lov turi "qarz" → pul kelmagan. Qancha kelgani QARZ modulidan
 *      o'qiladi: `Debt.manbaTransactionId` (mavjud ko'prik, qarz
 *      migratsiyasi bilan bir xil) → `tolangan` va `status`.
 *      Qarz bekor qilingan bo'lsa (CANCELLED) — kelgan pul 0.
 *      Qarz yozuvi topilmasa — ehtiyotkorlik bilan "TOLANMAGAN"
 *      (pul kelganini tasdiqlaydigan manba yo'q).
 */

/** "TOLANMAGAN" — pul kelmagan; "QISMAN" — bir qismi; "TOLIQ" — hammasi. */
export type ZakazTolovHolati = "TOLANMAGAN" | "QISMAN" | "TOLIQ";

export interface ZakazTolovi {
  holati: ZakazTolovHolati;
  /** Haqiqatda kelib tushgan pul (so'm). */
  tolangan: number;
  /** Qolgan qarz (so'm). */
  qoldiq: number;
  /** Bonus bazasiga kiradigan summa — faqat TO'LIQ to'langanda to'liq summa. */
  puliKelgan: number;
}

export const TOLANMAGAN: ZakazTolovi = {
  holati: "TOLANMAGAN",
  tolangan: 0,
  qoldiq: 0,
  puliKelgan: 0,
};

/** Kirim yozuvining hisob uchun kerakli qismi. */
export interface KirimQismi {
  id: string;
  summa: number;
  tolovTuri: string | null;
  deletedAt: Date | null;
}

/** Qarz yozuvining hisob uchun kerakli qismi. */
export interface QarzQismi {
  jamiSumma: number;
  tolangan: number;
  status: string;
}

/**
 * SOF FUNKSIYA — bitta zakazning to'lov holati. Testlash oson, DB kerak emas.
 * `qarz` faqat kirim "qarz" turida bo'lganda ma'noga ega.
 */
export function tolovHisobla(
  kirim: KirimQismi | null | undefined,
  qarz: QarzQismi | null | undefined
): ZakazTolovi {
  if (!kirim || kirim.deletedAt) return TOLANMAGAN;

  if (kirim.tolovTuri !== "qarz") {
    // Naqd/Click (va to'lov turi ko'rsatilmagan eski yozuvlar): pul kassaga
    // tushgan — yozuvning o'zi to'liq to'lov dalili.
    return { holati: "TOLIQ", tolangan: kirim.summa, qoldiq: 0, puliKelgan: kirim.summa };
  }

  if (!qarz || qarz.status === "CANCELLED") {
    return { holati: "TOLANMAGAN", tolangan: 0, qoldiq: kirim.summa, puliKelgan: 0 };
  }

  const tolangan = Math.max(0, Math.min(qarz.tolangan, qarz.jamiSumma));
  const toliq = qarz.status === "PAID";
  return {
    holati: toliq ? "TOLIQ" : tolangan > 0 ? "QISMAN" : "TOLANMAGAN",
    tolangan,
    qoldiq: Math.max(0, qarz.jamiSumma - tolangan),
    // MUHIM: qisman to'langan zakaz bonusga KIRMAYDI — qarz to'liq
    // yopilgandagina butun summa bonus bazasiga qo'shiladi (17/18-talab).
    puliKelgan: toliq ? qarz.jamiSumma : 0,
  };
}

/**
 * Bir necha zakazning to'lov holati — IKKI so'rovda (N+1 yo'q).
 * Kalit: `Deal.id`. Ro'yxatda bo'lmagan zakaz = to'lanmagan.
 */
export async function zakazTolovlari(
  businessId: string,
  dealIdlar: string[]
): Promise<Map<string, ZakazTolovi>> {
  const natija = new Map<string, ZakazTolovi>();
  if (dealIdlar.length === 0) return natija;

  const zakazlar = await prisma.deal.findMany({
    where: { id: { in: dealIdlar }, businessId },
    select: {
      id: true,
      transaction: { select: { id: true, summa: true, tolovTuri: true, deletedAt: true } },
    },
  });

  // Qarzga yozilgan kirimlar uchun qarz yozuvlari — BITTA so'rovda.
  const qarzTxIdlar = zakazlar
    .filter((z) => z.transaction && !z.transaction.deletedAt && z.transaction.tolovTuri === "qarz")
    .map((z) => z.transaction!.id);
  const qarzlar = qarzTxIdlar.length
    ? await prisma.debt.findMany({
        where: { businessId, manbaTransactionId: { in: qarzTxIdlar } },
        select: { manbaTransactionId: true, jamiSumma: true, tolangan: true, status: true },
      })
    : [];
  const qarzXarita = new Map(qarzlar.map((q) => [q.manbaTransactionId!, q]));

  for (const z of zakazlar) {
    const qarz = z.transaction ? qarzXarita.get(z.transaction.id) ?? null : null;
    natija.set(z.id, tolovHisobla(z.transaction, qarz));
  }
  return natija;
}
