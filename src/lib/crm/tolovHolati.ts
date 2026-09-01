import { prisma } from "@/lib/prisma";

/**
 * ZAKAZ TO'LOV HOLATI — "puli kelgan sotuv" (FULLY PAID) yagona hisobi.
 *
 * NEGA ALOHIDA MODUL. `lib/crm/pipeline.ts` dagi `tolovHolati()` zakazning
 * YAKUNLASH PAYTIDAGI holatini beradi (`summa` va `tolangan` dan). Lekin
 * bonus uchun kerak bo'lgan savol boshqa: "keyinchalik qarz to'landimi?".
 * Qarz yopilishi `Debt` yozuvida bo'ladi, `Deal.tolangan` da EMAS —
 * shuning uchun bonus bazasi shu modulda, qarzni ham hisobga olib
 * hisoblanadi.
 *
 * HISOB QOIDASI (yangi hisoblagich SAQLANMAYDI):
 *   1. Oldindan olingan pul — `Deal.tolangan`.
 *   2. Yakunlashda ochilgan qarz (`Deal.debtId`) — undan kelib tushgani
 *      `Debt.tolangan`, to'liq yopilgani `Debt.status = "PAID"`.
 *      Bekor qilingan qarz (CANCELLED) — kelgan pul 0.
 *   3. ESKI YO'L (pipeline'gacha yozilgan zakazlar): kirim `tolovTuri`
 *      "qarz" bo'lsa qarz `Debt.manbaTransactionId` ko'prigi orqali
 *      topiladi (`scripts/qarz-migratsiya.ts` bilan bir xil bog'lanish);
 *      boshqa to'lov turida kirim yozuvining o'zi to'liq to'lov dalili.
 *
 * BONUS QOIDASI: qisman to'langan zakaz bonusga KIRMAYDI — qarz to'liq
 * yopilgandagina butun summa bazaga qo'shiladi.
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

/** Kirim yozuvining hisob uchun kerakli qismi (eski yo'l). */
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

/** Zakazning hisob uchun kerakli qismi. */
export interface ZakazQismi {
  summa: number;
  /** Yakunlashda oldindan olingan pul. */
  tolangan: number;
  /** Yakunlashda qarz ochilganmi (pipeline yo'li). */
  debtId: string | null;
}

function natija(summa: number, kelgan: number, toliq: boolean): ZakazTolovi {
  const tolangan = Math.max(0, Math.min(kelgan, summa));
  return {
    holati: toliq ? "TOLIQ" : tolangan > 0 ? "QISMAN" : "TOLANMAGAN",
    tolangan,
    qoldiq: Math.max(0, summa - tolangan),
    puliKelgan: toliq ? summa : 0,
  };
}

/**
 * SOF FUNKSIYA — bitta zakazning to'lov holati. Testlash oson, DB kerak emas.
 * `qarz` — zakazga bog'langan qarz yozuvi (bo'lmasa null).
 */
export function tolovHisobla(
  zakaz: ZakazQismi,
  qarz: QarzQismi | null | undefined,
  /** Eski (pipeline'gacha) zakazlarda — bog'langan kirim yozuvi. */
  kirim?: KirimQismi | null
): ZakazTolovi {
  if (zakaz.summa <= 0) return TOLANMAGAN;

  // PIPELINE YO'LI: qarz ochilgan bo'lsa yakuniy javob qarz yozuvida.
  if (zakaz.debtId) {
    if (!qarz || qarz.status === "CANCELLED") {
      return natija(zakaz.summa, zakaz.tolangan, false);
    }
    const toliq = qarz.status === "PAID";
    return natija(zakaz.summa, zakaz.tolangan + qarz.tolangan, toliq);
  }

  // Qarzsiz yakunlangan zakaz: oldindan olingan pulning o'zi yakuniy javob.
  if (zakaz.tolangan > 0) {
    return natija(zakaz.summa, zakaz.tolangan, zakaz.tolangan >= zakaz.summa);
  }

  // ESKI YO'L: pul faqat kirim yozuvi orqali ko'rinadi.
  if (!kirim || kirim.deletedAt) return { ...TOLANMAGAN, qoldiq: zakaz.summa };
  if (kirim.tolovTuri !== "qarz") {
    // Naqd/Click (va turi ko'rsatilmagan eski yozuvlar): pul kassaga tushgan.
    return natija(zakaz.summa, kirim.summa, true);
  }
  if (!qarz || qarz.status === "CANCELLED") return { ...TOLANMAGAN, qoldiq: zakaz.summa };
  return natija(zakaz.summa, qarz.tolangan, qarz.status === "PAID");
}

/**
 * Bir necha zakazning to'lov holati — IKKI so'rovda (N+1 yo'q).
 * Kalit: `Deal.id`. Ro'yxatda bo'lmagan zakaz = to'lanmagan.
 */
export async function zakazTolovlari(
  businessId: string,
  dealIdlar: string[]
): Promise<Map<string, ZakazTolovi>> {
  const natijalar = new Map<string, ZakazTolovi>();
  if (dealIdlar.length === 0) return natijalar;

  const zakazlar = await prisma.deal.findMany({
    where: { id: { in: dealIdlar }, businessId },
    select: {
      id: true,
      summa: true,
      tolangan: true,
      debtId: true,
      debt: { select: { jamiSumma: true, tolangan: true, status: true } },
      transaction: { select: { id: true, summa: true, tolovTuri: true, deletedAt: true } },
    },
  });

  // ESKI yo'l uchun qarzlar: `manbaTransactionId` ko'prigi — BITTA so'rovda.
  const eskiTxIdlar = zakazlar
    .filter((z) => !z.debtId && z.tolangan === 0 && z.transaction && !z.transaction.deletedAt)
    .filter((z) => z.transaction!.tolovTuri === "qarz")
    .map((z) => z.transaction!.id);
  const eskiQarzlar = eskiTxIdlar.length
    ? await prisma.debt.findMany({
        where: { businessId, manbaTransactionId: { in: [...new Set(eskiTxIdlar)] } },
        select: { manbaTransactionId: true, jamiSumma: true, tolangan: true, status: true },
      })
    : [];
  const eskiXarita = new Map(eskiQarzlar.map((q) => [q.manbaTransactionId!, q]));

  for (const z of zakazlar) {
    const qarz = z.debt ?? (z.transaction ? eskiXarita.get(z.transaction.id) ?? null : null);
    natijalar.set(z.id, tolovHisobla(z, qarz, z.transaction));
  }
  return natijalar;
}
