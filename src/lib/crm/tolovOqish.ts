import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/guard";
import { utcDateToDateOnlyString } from "@/lib/date";
import {
  qoldiqSumma,
  tolovHolati,
  yutishTosigi,
  zakazQarzdormi,
  QARZ_KANALI,
  type TolovHolat,
} from "@/lib/crm/pipeline";

/**
 * ZAKAZ TO'LOVLARINING YAGONA O'QISH NUQTASI.
 *
 * Doska kartasi, tafsilot oynasi va to'lov qo'shish javobi — hammasi SHU
 * hisobdan chiqadi. Ilgari har joy o'zicha hisoblardi (kimdir
 * `Deal.tolangan` dan, kimdir kirim yozuvlaridan), shuning uchun bir
 * zakazning "to'langan" raqami ikki ekranda ikki xil ko'rinishi mumkin edi.
 *
 * HISOB QOIDASI:
 *   tolangan = Σ DealTolov.summa   (eski, qatorsiz zakazda `Deal.tolangan`)
 *   qoldiq   = Deal.summa − tolangan
 *   qarz     = FAQAT ochilgan `Debt` yozuvi (qoldiq qarz EMAS)
 */

export interface ZakazTolovSatriDTO {
  id: string;
  /** "naqd" | "click" | "terminal" | "boshqa". */
  kanal: string;
  summa: number;
  /** Pul qaysi kunda kirimga tushdi ("YYYY-MM-DD") — kirimi yo'q bo'lsa null. */
  sana: string | null;
  /** Bog'langan kirim tranzaksiyasi (hali yozilmagan eski qatorda null). */
  transactionId: string | null;
  /** Kirim savatga tushganmi (yumshoq o'chirilgan) — jamiga kirmaydi. */
  kirimOchirilgan: boolean;
}

export interface ZakazTolovHisobiDTO {
  dealId: string;
  /** Zakaz jami summasi. */
  summa: number;
  /** Haqiqatda kelib tushgan pul (barcha to'lovlar yig'indisi). */
  tolangan: number;
  /** To'lanmagan qoldiq — QARZ EMAS. */
  qoldiq: number;
  holati: TolovHolat;
  /** `Deal.tolovTuri` — kanal belgisi yoki "qarz" (brauzer belgilarni shundan chizadi). */
  tolovTuri: string | null;
  /** "Qolgan summa qarzdorlikka" belgisi qo'yilganmi. */
  qarzga: boolean;
  tolovlar: ZakazTolovSatriDTO[];
  /** Kanal kesimida jami: "Naqd 200 000 · Click 550 000". */
  kanallar: Array<{ kanal: string; summa: number }>;
  /** KIRIMGA HAQIQATDA o'tgan summa (o'chirilgan yozuv sanalmaydi). */
  kirimSumma: number;
  /** Zakazning kirim tranzaksiyasi (eski bog'lanish — "moliyaga o'tganmi"). */
  transactionId: string | null;
  /** Yakunlashda ochilgan qarz yozuvi. */
  debtId: string | null;
  /** Ochilgan qarz qoldig'i (qarz yo'q bo'lsa 0). */
  qarzQoldiq: number;
  /** Ochiq qarz bormi — doskadagi "Qarz" ustunining sharti. */
  qarzOchiq: boolean;
  /**
   * "Yutildi" ga o'tishga to'siq sababi — `null` bo'lsa o'tsa bo'ladi.
   * Frontend tugmani shu bilan o'chiradi; server ayni qoidani mustaqil
   * majburlaydi (`lib/crm/yakunlash.ts`).
   */
  yutishTosigi: string | null;
}

/** Zakazning to'lov hisobi — bitta so'rovda. */
export async function zakazTolovHisobi(
  businessId: string,
  dealId: string
): Promise<ZakazTolovHisobiDTO> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId, deletedAt: null },
    select: {
      id: true,
      summa: true,
      tolangan: true,
      tolovTuri: true,
      transactionId: true,
      debtId: true,
      transaction: { select: { summa: true, deletedAt: true } },
      debt: { select: { jamiSumma: true, tolangan: true, status: true, isYopilgan: true } },
      tolovlar: {
        select: {
          id: true,
          kanal: true,
          summa: true,
          transactionId: true,
          transaction: { select: { summa: true, sana: true, deletedAt: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");

  const tolovlar: ZakazTolovSatriDTO[] = deal.tolovlar.map((t) => ({
    id: t.id,
    kanal: t.kanal,
    summa: t.summa,
    sana: t.transaction?.sana ? utcDateToDateOnlyString(t.transaction.sana) : null,
    transactionId: t.transactionId,
    kirimOchirilgan: Boolean(t.transaction?.deletedAt),
  }));

  // ESKI, QATORSIZ ZAKAZ: pul `Deal.tolangan` da turadi — u yo'qolmasin.
  const qatorJami = tolovlar.reduce((s, t) => s + t.summa, 0);
  const tolangan = Math.max(deal.tolangan, qatorJami);

  const kanallar = [...tolovlar.reduce((m, t) => m.set(t.kanal, (m.get(t.kanal) ?? 0) + t.summa), new Map<string, number>())]
    .map(([kanal, summa]) => ({ kanal, summa }));

  // KIRIM SUMMASI — YOZUVLARNING O'ZIDAN (`lib/crm/dto.ts` bilan AYNI
  // qoida): qatorlar bo'lsa ulardan, bo'lmasa zakazning eski bog'lanishidan.
  // Yumshoq o'chirilgan kirim sanalmaydi.
  const kirimSumma =
    deal.tolovlar.length > 0
      ? deal.tolovlar.reduce(
          (sum, t) => sum + (t.transaction && !t.transaction.deletedAt ? t.transaction.summa : 0),
          0
        )
      : deal.transaction && !deal.transaction.deletedAt
        ? deal.transaction.summa
        : 0;

  return {
    dealId: deal.id,
    summa: deal.summa,
    tolangan,
    qoldiq: qoldiqSumma(deal.summa, tolangan),
    holati: tolovHolati(deal.summa, tolangan, deal.tolovTuri),
    tolovTuri: deal.tolovTuri,
    qarzga: deal.tolovTuri === QARZ_KANALI,
    tolovlar,
    kanallar,
    kirimSumma,
    transactionId: deal.transactionId,
    debtId: deal.debtId,
    qarzQoldiq:
      deal.debt && deal.debt.status !== "CANCELLED"
        ? Math.max(0, deal.debt.jamiSumma - deal.debt.tolangan)
        : 0,
    qarzOchiq: zakazQarzdormi(deal.debt),
    yutishTosigi: yutishTosigi(deal.summa, tolangan, deal.tolovTuri),
  };
}
