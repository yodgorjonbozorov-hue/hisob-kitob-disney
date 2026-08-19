import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { createTransactionTx } from "@/lib/services/transactionService";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { logAudit } from "@/lib/services/audit";
import { todayDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";

/**
 * MAGAZIN (POS) XIZMAT QATLAMI — kassadagi savat sotuvi.
 *
 * ARXITEKTURA QARORI (muhim): savatdagi HAR SATR mavjud `Sale` yozuviga
 * aylanadi, ustidan esa bitta `PosChek` turadi.
 *
 * Nega yangi "PosSale" jadvali YARATILMADI: `Sale` allaqachon marja
 * (tannarx snapshot), ombor kamayishi, mijoz kartochkasi va oylik hisobot
 * bilan bog'langan. Parallel jadval qo'shilsa, o'sha hisobotlarning har biri
 * "ikki manbadan o'qish" ga aylanardi va POS savdosi hisobotlarda ko'rinmay
 * qolish xavfi tug'ilardi.
 *
 * PUL esa CHEK darajasida: xaridor 10 ta tovarni bitta to'lovda oladi, demak
 * kassaga BITTA kirim tranzaksiya tushishi kerak (10 ta emas). Shuning uchun
 * POS satrlarida `Sale.transactionId` ATAYLAB bo'sh qoladi — pul yozuvi
 * `PosChek.transactionId` da.
 *
 * Bularning hech biri mavjud bir mahsulotli sotuvga (`createSale`) tegmaydi:
 * u `chekId = null` bilan avvalgidek ishlaydi.
 */

/** Sotuv daromadi tushadigan kategoriya — `lib/services/inventory.ts` bilan bir xil nom. */
const SOTUV_KATEGORIYA = "Sotuv";

/** POS to'lov usullari. `Transaction.tolovTuri` dan farq qiladi — pastdagi izohga qarang. */
export const POS_TOLOV_TURLARI = ["naqd", "karta", "click", "qarz"] as const;
export type PosTolovTuri = (typeof POS_TOLOV_TURLARI)[number];

/**
 * POS to'lov usulini `Transaction.tolovTuri` ga o'giradi.
 *
 * Tizimda tranzaksiya darajasida faqat uch qiymat bor: "naqd" | "click" |
 * "qarz" (lib/validation/transaction.ts). Terminal orqali olingan pul —
 * naqdsiz, ya'ni kassa qoldig'ida "click" tarafida (aynan shu qoida
 * `lib/services/qarz.ts` da ham qo'llanadi). Kassir ko'radigan aniqroq nom
 * ("karta") esa `PosChek.tolovTuri` da saqlanadi.
 */
function tranzaksiyaTolovTuri(t: PosTolovTuri): "naqd" | "click" | "qarz" {
  if (t === "naqd") return "naqd";
  if (t === "qarz") return "qarz";
  return "click";
}

export interface PosSavatSatri {
  productId: string;
  miqdor: number;
  /**
   * Kelishilgan birlik narxi. Berilmasa katalogdagi `sotuvNarx` olinadi.
   *
   * DIQQAT: bu narx katalogga QAYTA YOZILMAYDI. Ilgari (H-1) chegirma bilan
   * sotilgan bitta dona butun katalog narxini o'zgartirib yuborardi.
   */
  narx?: number | null;
}

export interface PosSotuvParams {
  businessId: string;
  satrlar: PosSavatSatri[];
  tolovTuri: PosTolovTuri;
  /** Pul tushadigan kassa (Naqd / Click / Terminal). Berilmasa standart kassa. */
  accountId?: string | null;
  contactId?: string | null;
  mijozNomi?: string | null;
  mijozTel?: string | null;
  /** "YYYY-MM-DD". Berilmasa bugun. */
  sana?: string | null;
  userId: string;
}

/**
 * Bir productId savatda bir necha marta bo'lsa bitta satrga birlashtiradi.
 *
 * Kassada bu ODATIY holat: bir xil tovar ikki marta skanerlanadi. Birlashmasa
 * qoldiq ikki alohida shartli kamaytirish bilan tekshirilardi va "1 dona bor,
 * 2 marta skanerlandi" holatida ikkinchisi 400 xato berardi — kassir uchun
 * tushunarsiz. Endi jami miqdor bir marta tekshiriladi.
 */
function satrlarniBirlashtir(satrlar: PosSavatSatri[]): PosSavatSatri[] {
  const map = new Map<string, PosSavatSatri>();
  for (const s of satrlar) {
    const bor = map.get(s.productId);
    if (bor) {
      bor.miqdor += s.miqdor;
      // Oxirgi kiritilgan narx ustun turadi (kassir narxni tuzatgan bo'lishi mumkin).
      if (s.narx != null) bor.narx = s.narx;
    } else {
      map.set(s.productId, { productId: s.productId, miqdor: s.miqdor, narx: s.narx ?? null });
    }
  }
  return [...map.values()];
}

/** Biznes ichidagi keyingi chek raqami (tranzaksiya ichida chaqiriladi). */
async function keyingiChekRaqami(tx: BusinessTx, businessId: string): Promise<number> {
  const oxirgi = await tx.posChek.aggregate({
    where: { businessId },
    _max: { raqam: true },
  });
  return (oxirgi._max.raqam ?? 0) + 1;
}

export interface PosChekNatija {
  id: string;
  raqam: number;
  jamiSumma: number;
  tolovTuri: string;
  satrlar: Array<{ nomi: string; miqdor: number; birlikNarx: number; jamiSumma: number }>;
}

/**
 * SAVAT SOTUVI — BITTA ATOMIK AMALDA:
 *   1. har satr uchun ombor qoldig'i shartli kamaytiriladi (overselling yo'q);
 *   2. `PosChek` yaratiladi (biznes ichida ketma-ket raqam bilan);
 *   3. har satr uchun `Sale` yozuvi (tannarx snapshot bilan — marja hisobi);
 *   4. naqd/karta/click → BITTA kirim tranzaksiya; qarz → BITTA qarzdorlik.
 *
 * Yarim bajarilgan holat bo'lishi mumkin emas: `runBusinessTx` uzilishda
 * hammasini orqaga qaytaradi.
 */
export async function posSotuv(params: PosSotuvParams): Promise<PosChekNatija> {
  const satrlar = satrlarniBirlashtir(params.satrlar);
  if (satrlar.length === 0) {
    throw new BadRequestError("Savat bo'sh");
  }
  for (const s of satrlar) {
    if (!Number.isInteger(s.miqdor) || s.miqdor <= 0) {
      throw new BadRequestError("Miqdor musbat butun son bo'lishi kerak");
    }
  }
  if (params.tolovTuri === "qarz" && !params.mijozNomi?.trim()) {
    throw new BadRequestError("Qarzga sotishda mijoz nomi kiritilishi shart");
  }

  const sana = params.sana ?? todayDateOnlyString();
  const sanaDate = dateOnlyStringToUTCDate(sana);

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` ishlatiladi — HAR so'rovda `businessId`
    // sharti QO'LDA yoziladi (CLAUDE.md dagi kelishuv).
    const products = await tx.product.findMany({
      where: {
        id: { in: satrlar.map((s) => s.productId) },
        businessId: params.businessId,
        isActive: true,
      },
      select: { id: true, nomi: true, sotuvNarx: true, kelganNarx: true },
    });
    const pMap = new Map(products.map((p) => [p.id, p]));

    // Narxlar avval hisoblanadi: qarz limiti omborga TEGMASDAN oldin
    // tekshirilishi kerak.
    const hisob = satrlar.map((s) => {
      const p = pMap.get(s.productId);
      if (!p) throw new ForbiddenError("Mahsulot topilmadi");
      const kelishilgan = s.narx != null && s.narx > 0 ? Math.round(s.narx) : null;
      const birlikNarx = kelishilgan ?? p.sotuvNarx;
      if (birlikNarx <= 0) {
        throw new BadRequestError(`"${p.nomi}" uchun sotuv narxi kiritilmagan`);
      }
      return {
        product: p,
        miqdor: s.miqdor,
        birlikNarx,
        tannarx: p.kelganNarx,
        jamiSumma: birlikNarx * s.miqdor,
      };
    });

    const jamiSumma = hisob.reduce((a, h) => a + h.jamiSumma, 0);

    if (params.tolovTuri === "qarz" && params.contactId) {
      await qarzLimitTekshirTx(tx, params.businessId, params.contactId, jamiSumma);
    }

    // ---- Ombor: shartli atomik kamaytirish (parallel kassalar himoyasi) ----
    // `updateMany` filtriga `miqdor >= n` sharti kiradi, ya'ni yetarli qoldiq
    // bo'lmasa `count = 0` qaytadi va bironta qator o'zgarmaydi. Ikki kassir
    // bir vaqtda oxirgi donani sotsa faqat bittasi o'tadi.
    for (const h of hisob) {
      const upd = await tx.product.updateMany({
        where: { id: h.product.id, businessId: params.businessId, miqdor: { gte: h.miqdor } },
        data: { miqdor: { decrement: h.miqdor } },
      });
      if (upd.count === 0) {
        throw new BadRequestError(`"${h.product.nomi}" omborda yetarli emas`);
      }
    }

    const raqam = await keyingiChekRaqami(tx, params.businessId);
    const chek = await tx.posChek.create({
      data: {
        businessId: params.businessId,
        raqam,
        jamiSumma,
        tolovTuri: params.tolovTuri,
        contactId: params.contactId ?? undefined,
        mijozNomi: params.mijozNomi?.trim() || undefined,
        mijozTel: params.mijozTel?.trim() || undefined,
        userId: params.userId,
        sana: sanaDate,
      },
      select: { id: true, raqam: true },
    });

    for (const h of hisob) {
      await tx.sale.create({
        data: {
          businessId: params.businessId,
          productId: h.product.id,
          miqdor: h.miqdor,
          birlikNarx: h.birlikNarx,
          tannarx: h.tannarx,
          jamiSumma: h.jamiSumma,
          // Satr darajasidagi to'lov turi chek bilan bir xil bo'lishi uchun
          // "qarz" dan boshqasi "naqd" deb yoziladi: `Sale.tolovTuri`
          // tarixan ikki qiymatli ("naqd" | "qarz") va uni kengaytirish
          // eski sotuv hisobotlarini o'zgartirib yuborardi.
          tolovTuri: params.tolovTuri === "qarz" ? "qarz" : "naqd",
          contactId: params.contactId ?? undefined,
          mijozNomi: params.mijozNomi?.trim() || undefined,
          mijozTel: params.mijozTel?.trim() || undefined,
          sana: sanaDate,
          userId: params.userId,
          chekId: chek.id,
          // `transactionId` ATAYLAB bo'sh — pul yozuvi chekda (yuqoridagi izoh).
        },
      });
    }

    // ---- To'lov ----
    if (params.tolovTuri === "qarz") {
      const debt = await tx.debt.create({
        data: {
          businessId: params.businessId,
          turi: "olinadigan",
          contactId: params.contactId ?? undefined,
          mijozNomi: params.mijozNomi!.trim(),
          mijozTel: params.mijozTel?.trim() || undefined,
          jamiSumma,
          status: "OPEN",
          sana: sanaDate,
          izoh: `${chek.raqam}-chek`,
          userId: params.userId,
        },
        select: { id: true },
      });
      await tx.posChek.update({ where: { id: chek.id }, data: { debtId: debt.id } });
    } else {
      const categoryId = await ensureCategoryTx(tx, params.businessId, SOTUV_KATEGORIYA);
      const txn = await createTransactionTx(tx, params.userId, params.businessId, {
        turi: "kirim",
        categoryId,
        accountId: params.accountId ?? undefined,
        tolovTuri: tranzaksiyaTolovTuri(params.tolovTuri),
        summa: jamiSumma,
        sana,
        izoh: `${chek.raqam}-chek · ${hisob.length} ta tovar`,
      });
      await tx.posChek.update({
        where: { id: chek.id },
        data: { transactionId: txn.id, accountId: txn.accountId ?? undefined },
      });
    }

    return {
      id: chek.id,
      raqam: chek.raqam,
      jamiSumma,
      tolovTuri: params.tolovTuri,
      satrlar: hisob.map((h) => ({
        nomi: h.product.nomi,
        miqdor: h.miqdor,
        birlikNarx: h.birlikNarx,
        jamiSumma: h.jamiSumma,
      })),
    };
  });

  // `runBusinessTx` xom `tx` bilan ishlaydi — extension'dagi avtomatik audit
  // u yerda ishlamaydi, shuning uchun biznes hodisasi qo'lda yoziladi.
  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "posChek",
    entityId: natija.id,
    after: {
      raqam: natija.raqam,
      jamiSumma: natija.jamiSumma,
      tolovTuri: natija.tolovTuri,
      satrSoni: natija.satrlar.length,
    },
  });
  return natija;
}

/**
 * CHEKNI QAYTARISH (bekor qilish) — BITTA ATOMIK AMALDA:
 *   1. chek va uning barcha satrlari yumshoq o'chiriladi (tarix qoladi);
 *   2. har satr bo'yicha ombor qoldig'i QAYTARILADI;
 *   3. naqd/karta/click bo'lsa kirim tranzaksiya yumshoq o'chiriladi
 *      (kassadagi pul qaytadi);
 *   4. qarzga sotilgan bo'lsa qarz o'chiriladi — TO'LOVI BO'LMASA.
 *
 * Nega butun chek: kassada yarim chekni qaytarish pul va qoldiqni bir-biriga
 * mos kelmaydigan holatga olib keladi (chek summasi bir xil qoladi-yu, tovar
 * kamayadi). Bitta tovarni qaytarish kerak bo'lsa — chek qaytariladi va
 * qolgani qayta urib beriladi. Bu kassa dasturlarining odatiy qoidasi.
 */
export async function posChekBekor(params: {
  businessId: string;
  chekId: string;
  sabab: string;
  userId: string;
}) {
  const sabab = params.sabab.trim();
  if (!sabab) throw new BadRequestError("Qaytarish sababi yozilishi shart");

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const chek = await tx.posChek.findFirst({
      where: { id: params.chekId, businessId: params.businessId },
    });
    if (!chek) throw new ForbiddenError("Chek topilmadi");
    if (chek.deletedAt) throw new BadRequestError("Bu chek allaqachon qaytarilgan");

    if (chek.debtId) {
      const debt = await tx.debt.findFirst({
        where: { id: chek.debtId, businessId: params.businessId },
      });
      if (debt) {
        if (debt.tolangan > 0) {
          throw new BadRequestError(
            "Bu chek bo'yicha qarz to'lovi qilingan — avval to'lovlarni bekor qiling"
          );
        }
        await tx.debt.delete({ where: { id: debt.id } });
        await tx.posChek.update({ where: { id: chek.id }, data: { debtId: null } });
      }
    }

    if (chek.transactionId) {
      await tx.transaction.updateMany({
        where: { id: chek.transactionId, businessId: params.businessId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }

    const satrlar = await tx.sale.findMany({
      where: { chekId: chek.id, businessId: params.businessId, deletedAt: null },
      select: { id: true, productId: true, miqdor: true },
    });
    for (const s of satrlar) {
      await tx.product.updateMany({
        where: { id: s.productId, businessId: params.businessId },
        data: { miqdor: { increment: s.miqdor } },
      });
    }
    await tx.sale.updateMany({
      where: { chekId: chek.id, businessId: params.businessId, deletedAt: null },
      data: { deletedAt: new Date(), cancelledBy: params.userId, cancelReason: sabab },
    });

    await tx.posChek.update({
      where: { id: chek.id },
      data: { deletedAt: new Date(), cancelledBy: params.userId, cancelReason: sabab },
    });

    return { raqam: chek.raqam, jamiSumma: chek.jamiSumma, satrSoni: satrlar.length };
  });

  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "posChek",
    entityId: params.chekId,
    before: natija,
    after: { sabab },
  });
  return { ok: true, ...natija };
}
