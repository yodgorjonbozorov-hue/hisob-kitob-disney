import { prisma } from "@/lib/prisma";
import { monthRangeUTC } from "@/lib/date";

/**
 * XODIM SOTUVI — KPI bonusi uchun HAQIQAT MANBAI.
 *
 * SOTUV BAZADA TAKRORLANMAYDI. U mavjud kirim tranzaksiyalaridan o'qiladi,
 * chunki Balansada pul faqat o'sha yerda paydo bo'ladi: CRM buyurtmasi
 * kirimga ko'chirilganda Deal ↔ Transaction BIR-BIRGA bog'lanadi
 * (`Deal.transactionId` UNIQUE), ya'ni bitta real zakaz ROSA BIR MARTA
 * sanaladi. Sotuvchi hech qanday raqamni QO'LDA kiritmaydi.
 *
 * BIRIKTIRISH QOIDASI mavjud xodim statistikasi bilan AYNAN bir xil
 * (`lib/queries/xodimStatistika.ts`): `sotuvchiId` ustun (savdo kimniki),
 * u bo'lmasa `userId` (eski yozuvlar). Shu tufayli KPI sahifasidagi sotuv
 * bilan "Xodimlar statistikasi" sahifasidagi savdo bir-biriga qarshi
 * chiqmaydi.
 *
 * ---- FAQAT TO'LIQ TO'LANGAN SAVDO ----
 *
 * Bonus qo'lga TEGGAN pul uchun beriladi, va'da uchun emas. Uch holat:
 *
 *   · `tolovTuri = "qarz"` kirim — mahsulot ketdi, pul KELMADI. Bonusga
 *     KIRMAYDI (qarz yopilganda to'lov yozuvlari orqali kiradi).
 *   · Qarz TO'LOVI yozuvi — qarz TO'LIQ yopilgan bo'lsa (status "PAID")
 *     kiradi, qisman to'langan bo'lsa (OPEN/PARTIALLY_PAID) KIRMAYDI.
 *     Ya'ni qisman to'langan zakaz to'liq yopilmaguncha bonus bermaydi.
 *   · Bekor qilingan (yumshoq o'chirilgan) yozuv — hech qachon kirmaydi;
 *     bekor qilingan qarz (CANCELLED) ham "PAID" emas, demak kirmaydi.
 *
 * DAVR: yozuv O'Z SANASI oyiga tegishli. Qarz to'lovi to'langan kun bilan
 * yoziladi (lib/services/qarz.ts), shuning uchun u pul kelgan oyga tushadi.
 */

export interface SotuvYozuvi {
  id: string;
  summa: number;
  sana: Date;
  izoh: string | null;
  tolovTuri: string | null;
  kategoriya: string | null;
  /** CRM buyurtmasidan ko'chirilgan bo'lsa — buyurtma nomi. */
  crmNomi: string | null;
  /** Qarz to'lovi bo'lsa true (UI "qarz yopildi" deb ko'rsatadi). */
  qarzTolovi: boolean;
}

/** Bir foydalanuvchi (sotuvchi) bo'yicha oylik jam. */
export interface SotuvJami {
  summa: number;
  zakazlar: number;
}

/** Yozuv qaysi foydalanuvchiga tegishli — biriktirish qoidasining yagona joyi. */
function kimniki(t: { sotuvchiId: string | null; userId: string }): string {
  return t.sotuvchiId ?? t.userId;
}

interface XomYozuv {
  id: string;
  summa: number;
  sana: Date;
  izoh: string | null;
  tolovTuri: string | null;
  sotuvchiId: string | null;
  userId: string;
  category: { nomi: string } | null;
  crmBuyurtma: { nomi: string } | null;
}

/**
 * Oy ichidagi BONUSGA KIRADIGAN kirim yozuvlari.
 *
 * Ikki so'rov, N+1 yo'q: avval oyning kirimlari, keyin ULARDAN qaysilari
 * qarz to'lovi ekani (va qarzi yopilganmi) bitta o'qishda aniqlanadi.
 * So'rovlar hajmi oy ichidagi yozuvlar soni bilan chegaralangan — xodimlar
 * soni oshsa ham so'rovlar soni O'ZGARMAYDI.
 */
async function oyYozuvlari(
  businessId: string,
  oy: string
): Promise<Array<XomYozuv & { qarzTolovi: boolean }>> {
  const { from, to } = monthRangeUTC(oy);

  const rows = (await prisma.transaction.findMany({
    where: {
      businessId,
      turi: "kirim",
      deletedAt: null,
      sana: { gte: from, lt: to },
      // Qarzga savdo — pul kelmagan, bonusga kirmaydi (baza darajasida kesiladi).
      //
      // DIQQAT, NULL TUZOG'I: `NOT: { tolovTuri: "qarz" }` deb yozib bo'lmaydi.
      // SQL'da `NULL = 'qarz'` → NULL, `NOT NULL` → NULL, ya'ni ROST emas —
      // natijada `tolovTuri` bo'sh bo'lgan ESKI yozuvlar (sxemada: "Null —
      // eski yozuvlar, ularda tur kassa turidan chiqariladi") filtrdan
      // JIMGINA tushib qolardi va xodimning bonusi kam hisoblanardi.
      // Shuning uchun NULL ochiq-oydin ro'yxatga olinadi.
      OR: [{ tolovTuri: null }, { tolovTuri: { not: "qarz" } }],
    },
    select: {
      id: true,
      summa: true,
      sana: true,
      izoh: true,
      tolovTuri: true,
      sotuvchiId: true,
      userId: true,
      category: { select: { nomi: true } },
      crmBuyurtma: { select: { nomi: true } },
    },
    orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
  })) as XomYozuv[];

  if (rows.length === 0) return [];

  // Shu yozuvlardan qaysilari qarz to'lovi va qarzning holati qanday.
  const tolovlar = await prisma.debtPayment.findMany({
    where: { businessId, transactionId: { in: rows.map((r) => r.id) } },
    select: { transactionId: true, debt: { select: { status: true } } },
  });
  const tolovHolati = new Map<string, string>();
  for (const t of tolovlar) {
    if (t.transactionId) tolovHolati.set(t.transactionId, t.debt.status);
  }

  return rows
    .filter((r) => {
      const holat = tolovHolati.get(r.id);
      // Oddiy savdo (qarz to'lovi emas) — pul kelgan, kiradi.
      if (holat === undefined) return true;
      // Qarz to'lovi — faqat qarz TO'LIQ yopilgan bo'lsa.
      return holat === "PAID";
    })
    .map((r) => ({ ...r, qarzTolovi: tolovHolati.has(r.id) }));
}

/**
 * Barcha sotuvchilar bo'yicha oylik sotuv jamlari (userId → jam).
 * Dashboard shu bitta chaqiriq bilan 100+ xodimni ham qoplaydi.
 */
export async function sotuvJamlari(
  businessId: string,
  oy: string
): Promise<Map<string, SotuvJami>> {
  const rows = await oyYozuvlari(businessId, oy);
  const jam = new Map<string, SotuvJami>();
  for (const r of rows) {
    const kim = kimniki(r);
    const m = jam.get(kim) ?? { summa: 0, zakazlar: 0 };
    m.summa += r.summa;
    m.zakazlar += 1;
    jam.set(kim, m);
  }
  return jam;
}

/** Bitta sotuvchining oy ichidagi bonusga kiradigan yozuvlari (detal lentasi). */
export async function sotuvYozuvlari(
  businessId: string,
  userId: string,
  oy: string
): Promise<SotuvYozuvi[]> {
  const rows = await oyYozuvlari(businessId, oy);
  return rows
    .filter((r) => kimniki(r) === userId)
    .map((r) => ({
      id: r.id,
      summa: r.summa,
      sana: r.sana,
      izoh: r.izoh,
      tolovTuri: r.tolovTuri,
      kategoriya: r.category?.nomi ?? null,
      crmNomi: r.crmBuyurtma?.nomi ?? null,
      qarzTolovi: r.qarzTolovi,
    }));
}
