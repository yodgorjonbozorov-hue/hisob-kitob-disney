import { prisma } from "@/lib/prisma";
import { BadRequestError } from "@/lib/auth/guard";
import type { BusinessTx } from "@/lib/db/businessTx";
import { createTransactionTx } from "@/lib/services/transactionService";
import { shaxsiyKassaId } from "@/lib/services/kassaTanlash";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { utcDateToDateOnlyString, todayTashkentDateOnlyString } from "@/lib/date";
import { kirimIzohi } from "@/lib/crm/kirim";
import { satrIzohi, type KirimSatri } from "@/lib/crm/tolovlar";

/**
 * ZAKAZ TO'LOVIDAN KIRIM YOZISH — YAGONA joy.
 *
 * ═══ NEGA ALOHIDA MODUL ═══
 * Ilgari bu mantiq faqat `lib/crm/yakunlash.ts` ichida, "Yutildi" bosilgan
 * paytda ishlardi. Ya'ni 2 200 000 lik zakazga bugun kelgan 1 000 000 lik
 * zalog KASSADA KO'RINMASDI — pul qo'lda, lekin moliyada yo'q. Zakaz esa
 * to'liq to'lanmaguncha "Yutildi" bo'la olmaydi (`pipeline.ts` →
 * `yutishTosigi`), demak kutish muddati cheksiz edi.
 *
 * ENDI KIRIM PUL KELGAN PAYTDA YOZILADI: har `DealTolov` qatori tug'ilishi
 * bilan o'z `Transaction` ini oladi. "Yutildi" esa moliyaviy amal emas —
 * u zakaz yakunlangan STATUS. Yakunlashdagi eski sikl saqlanib qoldi,
 * lekin u endi faqat KIRIMI YO'Q qatorlarni to'ldiradi (eski zakazlar va
 * qaytarilgandan keyin qayta yakunlash), shuning uchun DUBLIKAT KIRIM
 * yuzaga kelmaydi.
 *
 * ═══ DUBLIKATGA QARSHI ═══
 * Bog'lanish `transactionId: null` sharti bilan yoziladi va yangilangan
 * qatorlar soni 1 emasligi butun tranzaksiyani qaytaradi. Ikki so'rov bir
 * vaqtda kelsa ikkinchisi bazaga tushmaydi (kafolat BAZA darajasida:
 * `DealTolov.transactionId` va `Deal.transactionId` — UNIQUE).
 */

/** Kategoriyasiz eski zakazlar uchun zaxira kategoriya (`kirim.ts` bilan bir xil). */
export const ZAXIRA_KATEGORIYA = "Sotuv";

/** Bitta zakaz uchun kirim yozishda kerak bo'ladigan barcha kontekst. */
export interface KirimKonteksti {
  businessId: string;
  /** Amalni bajarayotgan foydalanuvchi (audit/yaratuvchi). */
  userId: string;
  /**
   * SOTUVCHI = zakaz MAS'ULI, tugmani bosgan odam emas. Kassa ham shunga
   * qarab tanlanadi (`shaxsiyKassaId`) — zakazni olgan xodimning kassasi
   * ko'payadi va u shu pulni topshiradi.
   */
  sotuvchiId: string;
  /** Zakaz kategoriyasi — null bo'lsa zaxira kategoriya yaratiladi. */
  categoryId: string | null;
  /** Kirim izohi: "Xizmat — Mijoz". */
  izoh: string;
  /** Kirim sanasi "YYYY-MM-DD". */
  sana: string;
  /** Zakazda bir nechta kanal bormi — izohga kanal nomi qo'shiladi. */
  kopKanal: boolean;
  /** Foydalanuvchi ataylab tanlagan kassa (faqat bitta kanal bo'lganda). */
  accountId?: string | null;
}

/**
 * ZAKAZ KIRIM KONTEKSTINI YIG'ISH (tranzaksiyadan TASHQARIDA).
 *
 * Mas'ul xodim va sana shu yerda bir marta aniqlanadi, shunda tranzaksiya
 * ichida faqat yozuv qoladi (SQLite yozuv qulfi qisqa bo'lsin).
 */
export async function zakazKirimKonteksti(
  deal: {
    id: string;
    nomi: string;
    masulId: string;
    categoryId: string | null;
    sana: Date | null;
    contact?: { ism: string | null } | null;
  },
  params: { businessId: string; userId: string; kopKanal: boolean; accountId?: string | null; sana?: string }
): Promise<KirimKonteksti & { masul: { id: string; ism: string } | null }> {
  const masul = await prisma.user.findFirst({
    where: { id: deal.masulId },
    select: { id: true, ism: true },
  });
  return {
    businessId: params.businessId,
    userId: params.userId,
    sotuvchiId: masul?.id ?? params.userId,
    categoryId: deal.categoryId,
    izoh: kirimIzohi(deal.nomi, deal.contact?.ism),
    // Kirim sanasi — chaqiruvchi bergan sana, bo'lmasa ZAKAZ SANASI
    // (xizmat qaysi kunga bo'lsa), sanasiz eski zakazda bugun.
    sana: params.sana ?? (deal.sana ? utcDateToDateOnlyString(deal.sana) : todayTashkentDateOnlyString()),
    kopKanal: params.kopKanal,
    accountId: params.accountId ?? null,
    masul,
  };
}

/**
 * BITTA TO'LOV QATORI UCHUN KIRIM YOZADI va uni qatorga BOG'LAYDI.
 *
 * `satr.satrId` bo'lsa bog'lanish `DealTolov` ga, bo'lmasa (eski, qatorsiz
 * zakaz) `Deal.transactionId` ga yoziladi — ikkala yo'lda ham `null`
 * sharti bilan, ya'ni poyga himoyasi bir xil.
 */
export async function tolovKirimiYoz(
  tx: BusinessTx,
  ktx: KirimKonteksti,
  dealId: string,
  satr: KirimSatri
) {
  const categoryId =
    ktx.categoryId ?? (await ensureCategoryTx(tx, ktx.businessId, ZAXIRA_KATEGORIYA, "kirim"));

  // KASSA. Foydalanuvchi ataylab tanlagan kassa ustun; bo'lmasa shaxsiy
  // kassa rejimi qaraladi. NAQD bo'lmagan qism hech qachon shaxsiy kassaga
  // tushmaydi (`shaxsiyKassaId` faqat naqdga ishlaydi), demak click/terminal
  // puli karta/hisob kassasiga boradi. Kassani KIM tanlashi — chaqiruvchining
  // ishi: aralash to'lovda u `null` uzatadi, aks holda bitta kassaga ikki
  // kanalning puli qo'shilib ketardi.
  const accountId =
    ktx.accountId ?? (await shaxsiyKassaId(tx, ktx.businessId, ktx.sotuvchiId, satr.tolovTuri));

  const created = await createTransactionTx(tx, ktx.userId, ktx.businessId, {
    turi: "kirim",
    categoryId,
    summa: satr.summa,
    sana: ktx.sana,
    izoh: satrIzohi(ktx.izoh, satr.kanal, ktx.kopKanal),
    accountId,
    // QARZ kanali kirimga UZATILMAYDI: bu yerda yoziladigan pul HAQIQATDA
    // olingan pul (qolgani alohida qarz yozuvi bo'ladi).
    tolovTuri: satr.tolovTuri,
    sotuvchiId: ktx.sotuvchiId,
  });

  const bogland = satr.satrId
    ? await tx.dealTolov.updateMany({
        where: { id: satr.satrId, businessId: ktx.businessId, transactionId: null },
        data: { transactionId: created.id },
      })
    : await tx.deal.updateMany({
        where: { id: dealId, businessId: ktx.businessId, transactionId: null, deletedAt: null },
        data: { transactionId: created.id },
      });
  if (bogland.count !== 1) {
    throw new BadRequestError("Bu to'lov bo'yicha kirim allaqachon yozilgan");
  }

  // ORQAGA MOSLIK: `Deal.transactionId` — "kirim yozilganmi" degan savolning
  // eski javobi (ZakazMoliya, jamoa qulfi, KPI). Aralash to'lovda u BIRINCHI
  // kirimga bog'lanadi; to'liq summa esa qatorlardan yig'iladi.
  if (satr.satrId) {
    await tx.deal.updateMany({
      where: { id: dealId, businessId: ktx.businessId, transactionId: null, deletedAt: null },
      data: { transactionId: created.id },
    });
  }

  return created;
}
