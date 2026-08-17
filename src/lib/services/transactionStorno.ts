/**
 * TRANZAKSIYA STORNOSI — moliyaviy yozuvni "tuzatish"ning YAGONA yo'li.
 *
 * NEGA (audit: Critical #3). Ilgari `PATCH /api/transactions/[id]` summa,
 * sana va turini joyida o'zgartirardi: bir oy oldin yozilgan 500 000 so'mlik
 * kirimni bugun 50 000 ga aylantirib qo'yish mumkin edi va bazada avvalgi
 * qiymatdan iz qolmasdi. Moliyaviy yozuv esa tarix — u o'zgarmas bo'lishi
 * kerak, aks holda hisobotga ishonib bo'lmaydi.
 *
 * PATTERN loyihada allaqachon bor va shu yerda takrorlanadi:
 *   - `inventory.ts` / `cancelSale`  — sotuv yumshoq o'chiriladi, unga
 *     ulangan kirim tranzaksiyasi ham yumshoq o'chiriladi (pul qaytadi),
 *     sabab va aktor saqlanadi;
 *   - `qarz.ts` / `qarzBekor`        — yozuv o'chirilmaydi, "bekor" deb
 *     belgilanadi va sababi bilan jurnalga tushadi;
 *   - `userKassa.ts` / `cancelUserTransfer` — asl yozuv qoladi, qarama-qarshi
 *     yozuv qo'shiladi.
 *
 * Tranzaksiya jadvalida "qarama-qarshi yozuv" — bu `deletedAt` belgisi:
 * BARCHA hisobot, dashboard, kassa qoldig'i va kunlik hisobot so'rovlari
 * `deletedAt: null` bo'yicha filtrlaydi, ya'ni belgilangan yozuv pul
 * oqimidan chiqadi, lekin BAZADAN YO'QOLMAYDI (savatda ko'rinadi, tiklash
 * mumkin, zaxiraga tushadi).
 *
 * Shu bois storno = bitta ATOMIK amalda:
 *   1. asl yozuv bekor qilinadi (yumshoq o'chirish — pul teskariga qaytadi);
 *   2. kerak bo'lsa TUZATILGAN yangi yozuv qo'shiladi (yangi id bilan);
 *   3. sabab, aktor va ikkala yozuv identifikatori audit jurnaliga yoziladi.
 *
 * Natijada tarix to'liq o'qiladi: "shu yozuv shu sabab bilan bekor qilindi,
 * o'rniga mana bu yozildi" — hech narsa jimgina o'zgarmaydi.
 */
import { runBusinessTx } from "@/lib/db/businessTx";
import { BadRequestError, ForbiddenError, requireOwnerOrAdmin } from "@/lib/auth/guard";
import { logAudit } from "@/lib/services/audit";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { createTransactionTx, type CreateTransactionData } from "@/lib/services/transactionService";
import type { Rol } from "@/lib/auth/roles";

export interface StornoParams {
  businessId: string;
  transactionId: string;
  /** Nega bekor qilinmoqda — MAJBURIY, audit jurnaliga tushadi. */
  sabab: string;
  actorId: string;
  actorRol: Rol;
  /** Berilsa — asl yozuv o'rniga yoziladigan tuzatilgan yozuv. */
  tuzatish?: CreateTransactionData | null;
}

/** Storno natijasi: bekor qilingan asl yozuv va (bo'lsa) uning o'rnini bosgani. */
export interface StornoNatija {
  bekorQilingan: { id: string; turi: string; summa: number; sana: Date };
  tuzatilgan: { id: string } | null;
}

/**
 * Yozuvni bekor qiladi va (ixtiyoriy) tuzatilgan nusxasini yozadi.
 *
 * Ruxsat PATCH'dagi bilan BIR XIL qoidada: boshqaruvchi har qanday yozuvni,
 * xodim esa faqat o'zi kiritganini bekor qila oladi. Ya'ni bu yo'l hech
 * kimga yangi huquq bermaydi — faqat o'zgartirish usulini almashtiradi.
 */
export async function stornoTransaction(params: StornoParams): Promise<StornoNatija> {
  const sabab = params.sabab.trim();
  if (!sabab) throw new BadRequestError("Bekor qilish sababi yozilishi shart");

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    // Tranzaksiya ichida xom `tx` ishlatiladi — `businessId` sharti QO'LDA.
    const asl = await tx.transaction.findFirst({
      where: { id: params.transactionId, businessId: params.businessId },
    });
    if (!asl) throw new ForbiddenError("Tranzaksiya topilmadi");
    if (asl.deletedAt) throw new BadRequestError("Bu yozuv allaqachon bekor qilingan");

    requireOwnerOrAdmin(params.actorRol, params.actorId, asl.userId);

    // 1. Asl yozuv bekor qilinadi. `updateMany` + `deletedAt: null` sharti —
    //    ikki parallel storno bir yozuvni ikki marta bekor qilmasin.
    const upd = await tx.transaction.updateMany({
      where: { id: asl.id, businessId: params.businessId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (upd.count === 0) {
      throw new BadRequestError("Yozuv holati o'zgardi — sahifani yangilab qayta urinib ko'ring");
    }

    // 2. Tuzatilgan yozuv (berilgan bo'lsa) — SHU tranzaksiya ichida, ya'ni
    //    bekor qilish yoki yangi yozuv birgalikda bo'ladi yoki umuman bo'lmaydi.
    const tuzatilgan = params.tuzatish
      ? await createTransactionTx(tx, params.actorId, params.businessId, params.tuzatish)
      : null;

    const bekorQilingan = await tx.transaction.findUniqueOrThrow({ where: { id: asl.id } });
    return { bekorQilingan, tuzatilgan };
  });

  // Audit: `runBusinessTx` ichidagi amallar avtomatik audit extension'idan
  // O'TMAYDI (xom `tx`), shuning uchun qo'lda yoziladi — `cancelSale` kabi.
  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "transaction",
    entityId: params.transactionId,
    before: {
      turi: natija.bekorQilingan.turi,
      summa: natija.bekorQilingan.summa,
      sana: natija.bekorQilingan.sana,
      tolovTuri: natija.bekorQilingan.tolovTuri,
      categoryId: natija.bekorQilingan.categoryId,
    },
    after: {
      holat: "bekor qilindi",
      sabab,
      tuzatilganId: natija.tuzatilgan?.id ?? null,
    },
  });

  // Kunlik hisobot bilan sinxron: bekor qilingani chiqadi, tuzatilgani
  // (bugungi kirim bo'lsa) tushadi. Tranzaksiyadan KEYIN — `kunlikSinxron`
  // o'zi ham `runBusinessTx` ochadi.
  await kunlikSinxron(natija.bekorQilingan, null);
  if (natija.tuzatilgan) {
    await kunlikSinxron(natija.tuzatilgan, null);
  }

  return {
    bekorQilingan: {
      id: natija.bekorQilingan.id,
      turi: natija.bekorQilingan.turi,
      summa: natija.bekorQilingan.summa,
      sana: natija.bekorQilingan.sana,
    },
    tuzatilgan: natija.tuzatilgan ? { id: natija.tuzatilgan.id } : null,
  };
}
