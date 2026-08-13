import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { createTransactionTx } from "@/lib/services/transactionService";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { todayTashkentDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";
import { isAvto } from "@/lib/biznesTuri";
import { logAudit } from "@/lib/services/audit";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { kunlikSinxron, type KunlikSinxronYozuv } from "@/lib/services/kunlik";

/**
 * Tranzaksiya ichida yozilgan KIRIMNI kunlik hisobotga ulaydi (C-3).
 *
 * MUHIM: bu funksiya `runBusinessTx` TUGAGANDAN KEYIN chaqiriladi —
 * `kunlikSinxron` o'zi alohida `runBusinessTx` ochadi, ichma-ich tranzaksiya
 * SQLite'da deadlock beradi. Sinxron xatosi asosiy pul yozuvini buzmaydi
 * (`kunlikSinxron` ichida ushlanadi).
 */
async function kunlikkaUla(txn: KunlikSinxronYozuv | null): Promise<void> {
  if (!txn) return;
  const user = await prisma.user.findFirst({
    where: { id: txn.userId },
    select: { ism: true },
  });
  await kunlikSinxron(txn, user?.ism ?? null);
}

// Sotuv va qarz to'lovi uchun avtomatik ishlatiladigan kategoriyalar.
const SOTUV_KATEGORIYA = "Sotuv";
const QARZ_TOLOVI_KATEGORIYA = "Qarz to'lovi";
// Biz qarzdor bo'lgan qarzni to'laganda — chiqim kategoriyasi.
const QARZ_TOLASH_KATEGORIYA = "Qarz to'lash";
// Avto rejimi: mashina naqdga olinganda — chiqim kategoriyasi.
const MASHINA_XARIDI_KATEGORIYA = "Mashina xaridi";
// Mashinaga qilingan xarajatlar (ta'mirlash, bo'yoq...) — chiqim kategoriyasi.
const MASHINA_XARAJATI_KATEGORIYA = "Mashina xarajati";

/** Xarajat turlarining ko'rinadigan nomlari (UI, bot va tranzaksiya izohi uchun). */
export const XARAJAT_TURLARI = {
  tamirlash: "Ta'mirlash",
  boyoq: "Bo'yoq",
  yuvish: "Yuvish",
  rasmiylashtirish: "Rasmiylashtirish",
  ehtiyot_qism: "Ehtiyot qism",
  boshqa: "Boshqa",
} as const;

export type XarajatTuri = keyof typeof XARAJAT_TURLARI;

/**
 * Biznes uchun kategoriyani topadi yoki yaratadi (sotuv/qarz avtomatik yozuvlari uchun).
 *
 * `upsert` ishlatiladi: eski `findFirst → create` ketma-ketligi ikkita parallel
 * sotuvda `@@unique([nomi, turi, businessId])` ni buzib 500 xato berardi.
 */
export async function ensureCategoryTx(
  tx: BusinessTx,
  businessId: string,
  nomi: string,
  turi: "kirim" | "chiqim" = "kirim"
): Promise<string> {
  const cat = await tx.category.upsert({
    where: { nomi_turi_businessId: { nomi, turi, businessId } },
    update: {},
    create: { businessId, nomi, turi },
    select: { id: true },
  });
  return cat.id;
}

/** Tranzaksiyadan tashqarida chaqirish uchun (bot, eski chaqiruvchilar). */
export async function ensureCategory(
  businessId: string,
  nomi: string,
  turi: "kirim" | "chiqim" = "kirim"
): Promise<string> {
  const existing = await prisma.category.findFirst({ where: { businessId, nomi, turi } });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { businessId, nomi, turi } });
  return created.id;
}

interface StockEntryParams {
  businessId: string;
  productId: string;
  miqdor: number;
  birlikNarx?: number | null;
  userId: string;
  izoh?: string | null;
}

/** Ombor kirimi (tranzaksiya ichida): qoldiq oshirish + StockEntry bitta amalda. */
async function createStockEntryTx(tx: BusinessTx, params: StockEntryParams) {
  const product = await tx.product.findFirst({
    where: { id: params.productId, businessId: params.businessId },
  });
  if (!product) throw new ForbiddenError("Mahsulot topilmadi");

  const birlikNarx = params.birlikNarx ?? product.kelganNarx;

  await tx.product.update({
    where: { id: product.id },
    data: { miqdor: { increment: params.miqdor } },
  });

  return tx.stockEntry.create({
    data: {
      businessId: params.businessId,
      productId: product.id,
      miqdor: params.miqdor,
      birlikNarx,
      userId: params.userId,
      izoh: params.izoh ?? undefined,
    },
  });
}

/** Ombor kirimi — mahsulot qoldig'ini oshiradi. Chiqim tranzaksiya YARATMAYDI. */
export async function createStockEntry(params: StockEntryParams) {
  const entry = await runBusinessTx(params.businessId, (tx) => createStockEntryTx(tx, params));
  // runBusinessTx xom `tx` delegatlarini ishlatadi — tenant extension'idagi
  // avtomatik audit u yerda ishlamaydi, shuning uchun biznes hodisasi qo'lda yoziladi.
  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "product",
    entityId: params.productId,
    after: { omborKirimi: true, miqdor: params.miqdor, stockEntryId: entry.id },
  });
  return entry;
}

/**
 * Sotuv — mahsulot qoldig'ini atomik kamaytiradi (overselling'dan himoya).
 * Naqd → kirim tranzaksiya; qarz → Debt (daromad yozilmaydi, to'lovda yoziladi).
 */
export async function createSale(params: {
  businessId: string;
  productId: string;
  miqdor: number;
  tolovTuri: "naqd" | "qarz";
  /** Mijoz kartochkasi (ixtiyoriy). Berilsa qarz limiti tekshiriladi. */
  contactId?: string | null;
  mijozNomi?: string | null;
  mijozTel?: string | null;
  /**
   * Haqiqiy kelishilgan narx (birlik uchun). Avto rejimida narx deyarli har doim
   * savdolashib belgilanadi — berilsa shu narx ishlatiladi va mahsulot kartochkasi
   * ham yangilanadi. Berilmasa rejadagi sotuv narxi olinadi.
   */
  narx?: number | null;
  /** Naqd sotuvda pul tushadigan kassa (naqd/Click/terminal). Berilmasa — standart kassa. */
  accountId?: string | null;
  /** Sotuv sanasi "YYYY-MM-DD". Berilmasa bugun (kechagi sotuvni ham kiritish mumkin). */
  sana?: string | null;
  userId: string;
}) {
  const sana = params.sana ?? todayTashkentDateOnlyString();
  const { sotuv, kirimTxn } = await runBusinessTx(params.businessId, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: params.productId, businessId: params.businessId, isActive: true },
    });
    if (!product) throw new ForbiddenError("Mahsulot topilmadi");

    const kelishilganNarx = params.narx && params.narx > 0 ? Math.round(params.narx) : null;
    if (!kelishilganNarx && product.sotuvNarx <= 0) {
      throw new BadRequestError("Sotuv narxi kiritilmagan");
    }
    if (params.tolovTuri === "qarz" && !params.mijozNomi?.trim()) {
      throw new BadRequestError("Qarzga sotishda mijoz nomi kiritilishi shart");
    }

    // Qarz limiti — qoldiq kamaytirilishidan OLDIN tekshiriladi, shu bilan
    // limitdan oshgan sotuv omborga umuman tegmaydi (tranzaksiya orqaga
    // qaytadi, lekin tartib baribir aniq bo'lgani ma'qul).
    if (params.tolovTuri === "qarz" && params.contactId) {
      const narx =
        kelishilganNarx && kelishilganNarx > 0 ? kelishilganNarx : product.sotuvNarx;
      await qarzLimitTekshirTx(tx, params.businessId, params.contactId, narx * params.miqdor);
    }

    // Atomik shartli kamaytirish — yetarli qoldiq bo'lsagina bajariladi.
    const upd = await tx.product.updateMany({
      where: { id: product.id, businessId: params.businessId, miqdor: { gte: params.miqdor } },
      data: { miqdor: { decrement: params.miqdor } },
    });
    if (upd.count === 0) {
      throw new BadRequestError("Omborda yetarli emas");
    }

    const birlikNarx = kelishilganNarx ?? product.sotuvNarx;
    const tannarx = product.kelganNarx;
    const jamiSumma = birlikNarx * params.miqdor;

    // AVTO rejimida kelishilgan narx kartochkaga yoziladi: bitta yozuv = bitta
    // mashina, narx esa har doim savdolashib belgilanadi.
    //
    // Oddiy omborda esa BU HALOKATLI edi (H-1): 500 dona tovardan bittasini
    // chegirma bilan sotsangiz butun katalog narxi o'zgarib ketardi va keyingi
    // barcha sotuvlar chegirma narxida ketardi. Shuning uchun endi faqat avto.
    const biznes = await tx.business.findFirst({
      where: { id: params.businessId },
      select: { turi: true },
    });
    if (isAvto(biznes?.turi) && kelishilganNarx && kelishilganNarx !== product.sotuvNarx) {
      await tx.product.update({
        where: { id: product.id },
        data: { sotuvNarx: kelishilganNarx },
      });
    }

    const sale = await tx.sale.create({
      data: {
        businessId: params.businessId,
        productId: product.id,
        miqdor: params.miqdor,
        birlikNarx,
        tannarx,
        jamiSumma,
        tolovTuri: params.tolovTuri,
        contactId: params.contactId ?? undefined,
        mijozNomi: params.mijozNomi?.trim() || undefined,
        mijozTel: params.mijozTel?.trim() || undefined,
        sana: dateOnlyStringToUTCDate(sana),
        userId: params.userId,
      },
    });

    let kirimTxn: KunlikSinxronYozuv | null = null;
    if (params.tolovTuri === "naqd") {
      // Naqd sotuv — darhol kirim tranzaksiya (kassa usuli).
      const categoryId = await ensureCategoryTx(tx, params.businessId, SOTUV_KATEGORIYA);
      const txn = await createTransactionTx(tx, params.userId, params.businessId, {
        turi: "kirim",
        categoryId,
        accountId: params.accountId ?? undefined,
        summa: jamiSumma,
        sana,
        izoh: `${product.nomi} × ${params.miqdor}`,
      });
      await tx.sale.update({ where: { id: sale.id }, data: { transactionId: txn.id } });
      kirimTxn = txn;
    } else {
      // Qarz — daromad yozilmaydi, qarzdorlik yaratiladi (bizga qarzdor).
      await tx.debt.create({
        data: {
          businessId: params.businessId,
          turi: "olinadigan",
          saleId: sale.id,
          productId: product.id,
          contactId: params.contactId ?? undefined,
          mijozNomi: params.mijozNomi!.trim(),
          mijozTel: params.mijozTel?.trim() || undefined,
          jamiSumma,
          userId: params.userId,
        },
      });
    }

    return {
      sotuv: await tx.sale.findUnique({
        where: { id: sale.id },
        include: { product: { select: { nomi: true } } },
      }),
      kirimTxn,
    };
  });

  // Naqd sotuv kunlik hisobotga tushadi (C-3) — tranzaksiya TASHQARISIDA.
  await kunlikkaUla(kirimTxn);

  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "sale",
    entityId: sotuv?.id ?? "?",
    after: {
      productId: params.productId,
      miqdor: params.miqdor,
      jamiSumma: sotuv?.jamiSumma,
      tolovTuri: params.tolovTuri,
      mijozNomi: sotuv?.mijozNomi,
    },
  });
  return sotuv;
}

/**
 * SOTUVNI BEKOR QILISH (B-4).
 *
 * Ilgari bu umuman mumkin emas edi: kassir xato sotuv kiritsa omborda tovar
 * kam, kassada pul ko'p bo'lib qolardi va tuzatib bo'lmasdi.
 *
 * Bitta atomik amalda:
 *   1. Sale yumshoq o'chiriladi (tarix saqlanadi — kim, qachon, nega);
 *   2. bog'langan kirim tranzaksiyasi yumshoq o'chiriladi (kassa qoldig'i tiklanadi);
 *   3. qarzga sotuv bo'lsa — qarz o'chiriladi (TO'LOVI BO'LMASA);
 *   4. ombor qoldig'i qaytariladi.
 */
export async function cancelSale(params: {
  businessId: string;
  saleId: string;
  sabab: string;
  userId: string;
}) {
  const sabab = params.sabab.trim();
  if (!sabab) throw new BadRequestError("Bekor qilish sababi yozilishi shart");

  const { natija, ochirilganTxn } = await runBusinessTx(params.businessId, async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: params.saleId, businessId: params.businessId },
    });
    if (!sale) throw new ForbiddenError("Sotuv topilmadi");
    if (sale.deletedAt) throw new BadRequestError("Bu sotuv allaqachon bekor qilingan");

    // Qarzga sotuv: to'lov qilingan bo'lsa avval to'lovlar bekor qilinishi kerak,
    // aks holda qarz to'lovi "havoda" qolib ketadi.
    const debt = await tx.debt.findFirst({
      where: { saleId: sale.id, businessId: params.businessId },
    });
    if (debt) {
      if (debt.tolangan > 0) {
        throw new BadRequestError(
          "Bu sotuv bo'yicha qarz to'lovi qilingan — avval to'lovlarni bekor qiling"
        );
      }
      await tx.debt.delete({ where: { id: debt.id } });
    }

    // Naqd sotuvning kirim tranzaksiyasi — soft delete (kassadagi pul qaytadi).
    let ochirilganTxn: KunlikSinxronYozuv | null = null;
    if (sale.transactionId) {
      await tx.transaction.updateMany({
        where: { id: sale.transactionId, businessId: params.businessId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      // O'chirilgandan KEYINGI holat — kunlik sinxron shu bo'yicha yozuvni chiqaradi.
      ochirilganTxn = await tx.transaction.findFirst({
        where: { id: sale.transactionId, businessId: params.businessId },
      });
    }

    // Ombor qoldig'i qaytadi.
    await tx.product.updateMany({
      where: { id: sale.productId, businessId: params.businessId },
      data: { miqdor: { increment: sale.miqdor } },
    });

    await tx.sale.update({
      where: { id: sale.id },
      data: { deletedAt: new Date(), cancelledBy: params.userId, cancelReason: sabab },
    });

    return {
      natija: { productId: sale.productId, miqdor: sale.miqdor, jamiSumma: sale.jamiSumma },
      ochirilganTxn,
    };
  });

  // Bekor qilingan sotuvning kirimi kunlikdan ham chiqadi (C-3) — tranzaksiya tashqarisida.
  await kunlikkaUla(ochirilganTxn);

  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "sale",
    entityId: params.saleId,
    before: natija,
    after: { sabab },
  });
  return { ok: true, ...natija };
}

/**
 * Qarz to'lovi — qarzni kamaytiradi va pul harakatini yozadi:
 *  - "olinadigan" (bizga qarzdor) → kirim tranzaksiya;
 *  - "beriladigan" (biz qarzdormiz) → chiqim tranzaksiya.
 */
export async function recordDebtPayment(params: {
  businessId: string;
  debtId: string;
  summa: number;
  userId: string;
}) {
  const { qarz, kirimTxn } = await runBusinessTx(params.businessId, async (tx) => {
    const debt = await tx.debt.findFirst({
      where: { id: params.debtId, businessId: params.businessId },
    });
    if (!debt) throw new ForbiddenError("Qarz topilmadi");
    if (debt.isYopilgan) throw new BadRequestError("Bu qarz allaqachon yopilgan");

    const qolgan = debt.jamiSumma - debt.tolangan;
    if (params.summa > qolgan) {
      throw new BadRequestError("To'lov summasi qolgan qarzdan ko'p");
    }

    const beriladigan = debt.turi === "beriladigan";
    const categoryId = await ensureCategoryTx(
      tx,
      params.businessId,
      beriladigan ? QARZ_TOLASH_KATEGORIYA : QARZ_TOLOVI_KATEGORIYA,
      beriladigan ? "chiqim" : "kirim"
    );
    const txn = await createTransactionTx(tx, params.userId, params.businessId, {
      turi: beriladigan ? "chiqim" : "kirim",
      categoryId,
      summa: params.summa,
      sana: todayTashkentDateOnlyString(),
      izoh: `${beriladigan ? "Qarz to'lash" : "Qarz to'lovi"}: ${debt.mijozNomi}`,
    });

    await tx.debtPayment.create({
      data: {
        debtId: debt.id,
        businessId: params.businessId,
        summa: params.summa,
        userId: params.userId,
        transactionId: txn.id,
      },
    });

    // Optimistik qulf: `tolangan` biz o'qigan qiymatda qolgan bo'lsagina yoziladi.
    // Ikki xodim bir vaqtda to'lov kiritsa — ikkinchisi jimgina yo'qolmaydi.
    const yangiTolangan = debt.tolangan + params.summa;
    const upd = await tx.debt.updateMany({
      where: {
        id: debt.id,
        businessId: params.businessId,
        tolangan: debt.tolangan,
        isYopilgan: false,
      },
      data: {
        tolangan: yangiTolangan,
        isYopilgan: yangiTolangan >= debt.jamiSumma,
      },
    });
    if (upd.count === 0) {
      throw new BadRequestError("Qarz holati o'zgardi — sahifani yangilab qayta urinib ko'ring");
    }

    return {
      qarz: await tx.debt.findUniqueOrThrow({ where: { id: debt.id } }),
      // Faqat KIRIM (olinadigan qarz to'lovi) kunlikka tushadi — chiqim kuzatilmaydi.
      kirimTxn: beriladigan ? null : txn,
    };
  });

  // Qarz to'lovi (kirim) kunlik hisobotga tushadi (C-3) — tranzaksiya tashqarisida.
  await kunlikkaUla(kirimTxn);

  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "debtPayment",
    entityId: params.debtId,
    after: { summa: params.summa, tolangan: qarz.tolangan, isYopilgan: qarz.isYopilgan },
  });
  return qarz;
}

/**
 * Qo'lda qarzdorlik yaratish — ikki yo'nalishda ham.
 * Pul harakati YOZILMAYDI: kirim/chiqim tranzaksiya to'lov paytida yoziladi
 * (kassa usuli — recordDebtPayment).
 */
export interface CreateDebtParams {
  businessId: string;
  turi: "olinadigan" | "beriladigan";
  mijozNomi: string;
  mijozTel?: string | null;
  jamiSumma: number;
  tolangan?: number;
  productId?: string | null;
  muddat?: string | null;
  izoh?: string | null;
  userId: string;
}

/** `createDebt`ning tranzaksiya ichida ishlaydigan varianti. */
async function createDebtTx(tx: BusinessTx, params: CreateDebtParams) {
  const nomi = params.mijozNomi.trim();
  if (!nomi) throw new BadRequestError("Ism kiritilishi shart");
  if (params.jamiSumma <= 0) throw new BadRequestError("Summa musbat bo'lishi kerak");

  const tolangan = params.tolangan ?? 0;
  if (tolangan < 0 || tolangan > params.jamiSumma) {
    throw new BadRequestError("To'langan summa qarz summasidan ko'p bo'lmasligi kerak");
  }

  if (params.productId) {
    const product = await tx.product.findFirst({
      where: { id: params.productId, businessId: params.businessId },
      select: { id: true },
    });
    if (!product) throw new ForbiddenError("Mahsulot topilmadi");
  }

  return tx.debt.create({
    data: {
      businessId: params.businessId,
      turi: params.turi,
      mijozNomi: nomi,
      mijozTel: params.mijozTel?.trim() || undefined,
      jamiSumma: params.jamiSumma,
      tolangan,
      isYopilgan: tolangan >= params.jamiSumma,
      productId: params.productId || undefined,
      muddat: params.muddat ? new Date(params.muddat) : undefined,
      izoh: params.izoh?.trim() || undefined,
      userId: params.userId,
    },
  });
}

export async function createDebt(params: CreateDebtParams) {
  const qarz = await runBusinessTx(params.businessId, (tx) => createDebtTx(tx, params));
  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "debt",
    entityId: qarz.id,
    after: { turi: qarz.turi, mijozNomi: qarz.mijozNomi, jamiSumma: qarz.jamiSumma },
  });
  return qarz;
}

/**
 * AVTO REJIMI — avtoparkka mashina qabul qilish (bitta amalda):
 *  1) Product (bitta mashina) + StockEntry (1 dona, olingan narx snapshot);
 *  2) naqd olingan bo'lsa — chiqim tranzaksiya ("Mashina xaridi");
 *     qarzga olingan bo'lsa — "beriladigan" qarz (pul chiqimi to'lovda yoziladi).
 * Sotilganda foyda = sotuv narxi − olingan narx (getProductProfitability).
 */
export async function createAvtoMashina(params: {
  businessId: string;
  nomi: string;
  olinganNarx: number;
  sotuvNarx?: number | null;
  avtoYil?: number | null;
  avtoRaqam?: string | null;
  avtoRang?: string | null;
  izoh?: string | null;
  /** Mashina qanday olindi: naqd pulga yoki qarzga (egasiga keyin to'lanadi). */
  tolovTuri: "naqd" | "qarz";
  /** Qarzga olinganda — kimdan olingani (qarzdorlik shu nom bilan yuritiladi). */
  egasiNomi?: string | null;
  egasiTel?: string | null;
  userId: string;
}) {
  const nomi = params.nomi.trim();
  if (!nomi) throw new BadRequestError("Model kiritilishi shart");
  if (params.olinganNarx <= 0) throw new BadRequestError("Olingan narx kiritilishi shart");
  if (params.tolovTuri === "qarz" && !params.egasiNomi?.trim()) {
    throw new BadRequestError("Qarzga olishda mashina egasining ismi kiritilishi shart");
  }

  const mashina = await runBusinessTx(params.businessId, async (tx) => {
    const product = await tx.product.create({
      data: {
        businessId: params.businessId,
        nomi,
        kelganNarx: params.olinganNarx,
        sotuvNarx: params.sotuvNarx ?? 0,
        miqdor: 0, // qoldiqni StockEntry oshiradi
        avtoYil: params.avtoYil ?? undefined,
        avtoRaqam: params.avtoRaqam?.trim() || undefined,
        avtoRang: params.avtoRang?.trim() || undefined,
        izoh: params.izoh?.trim() || undefined,
      },
    });

    await createStockEntryTx(tx, {
      businessId: params.businessId,
      productId: product.id,
      miqdor: 1,
      birlikNarx: params.olinganNarx,
      userId: params.userId,
      izoh:
        params.tolovTuri === "qarz" ? `Qarzga olindi: ${params.egasiNomi!.trim()}` : "Naqdga olindi",
    });

    const belgi = [nomi, params.avtoRaqam?.trim()].filter(Boolean).join(" ");

    if (params.tolovTuri === "naqd") {
      const categoryId = await ensureCategoryTx(
        tx,
        params.businessId,
        MASHINA_XARIDI_KATEGORIYA,
        "chiqim"
      );
      await createTransactionTx(tx, params.userId, params.businessId, {
        turi: "chiqim",
        categoryId,
        summa: params.olinganNarx,
        sana: todayTashkentDateOnlyString(),
        izoh: `Mashina xaridi: ${belgi}`,
      });
    } else {
      await createDebtTx(tx, {
        businessId: params.businessId,
        turi: "beriladigan",
        mijozNomi: params.egasiNomi!.trim(),
        mijozTel: params.egasiTel,
        jamiSumma: params.olinganNarx,
        productId: product.id,
        izoh: `Mashina uchun: ${belgi}`,
        userId: params.userId,
      });
    }

    return tx.product.findUniqueOrThrow({ where: { id: product.id } });
  });

  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "product",
    entityId: mashina.id,
    after: {
      nomi: mashina.nomi,
      avtoRaqam: mashina.avtoRaqam,
      olinganNarx: params.olinganNarx,
      tolovTuri: params.tolovTuri,
    },
  });
  return mashina;
}

/**
 * MASHINAGA XARAJAT QO'SHISH (ta'mirlash, bo'yoq, yuvish, rasmiylashtirish...).
 *
 * Xarajat aynan shu mashinaga yoziladi — sof foyda hisobida sotuv narxidan
 * ham olingan narx, ham shu xarajatlar ayriladi (getProductProfitability).
 *
 * Pul harakati mashina xaridi bilan bir xil qoidada:
 *  - "naqd" → darhol chiqim tranzaksiya ("Mashina xarajati" kategoriyasi);
 *  - "qarz" → "beriladigan" qarz (ustaga keyin to'lanadi), chiqim to'lov paytida.
 * Ya'ni xarajatni bu yerdan kiritgandan keyin uni yana qo'lda chiqimga
 * yozish SHART EMAS — ikki marta hisoblanib ketadi.
 */
export async function addProductExpense(params: {
  businessId: string;
  productId: string;
  turi: XarajatTuri;
  summa: number;
  izoh?: string | null;
  tolovTuri?: "naqd" | "qarz";
  kimga?: string | null;
  userId: string;
}) {
  if (params.summa <= 0) throw new BadRequestError("Summa musbat bo'lishi kerak");

  const xarajat = await runBusinessTx(params.businessId, async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: params.productId, businessId: params.businessId },
    });
    if (!product) throw new ForbiddenError("Mashina topilmadi");

    const tolovTuri = params.tolovTuri ?? "naqd";
    const kimga = params.kimga?.trim();
    if (tolovTuri === "qarz" && !kimga) {
      throw new BadRequestError("Keyin to'lanadigan bo'lsa — kimga to'lanishi yozilishi shart");
    }

    const turiNomi = XARAJAT_TURLARI[params.turi];
    const belgi = [product.nomi, product.avtoRaqam].filter(Boolean).join(" ");
    const izoh = params.izoh?.trim() || undefined;

    let transactionId: string | undefined;
    let debtId: string | undefined;

    if (tolovTuri === "naqd") {
      const categoryId = await ensureCategoryTx(
        tx,
        params.businessId,
        MASHINA_XARAJATI_KATEGORIYA,
        "chiqim"
      );
      const txn = await createTransactionTx(tx, params.userId, params.businessId, {
        turi: "chiqim",
        categoryId,
        summa: params.summa,
        sana: todayTashkentDateOnlyString(),
        izoh: `${turiNomi}: ${belgi}${izoh ? ` — ${izoh}` : ""}`,
      });
      transactionId = txn.id;
    } else {
      const debt = await createDebtTx(tx, {
        businessId: params.businessId,
        turi: "beriladigan",
        mijozNomi: kimga!,
        jamiSumma: params.summa,
        productId: product.id,
        izoh: `${turiNomi}: ${belgi}`,
        userId: params.userId,
      });
      debtId = debt.id;
    }

    return tx.productExpense.create({
      data: {
        businessId: params.businessId,
        productId: product.id,
        turi: params.turi,
        summa: params.summa,
        izoh,
        userId: params.userId,
        transactionId,
        debtId,
      },
    });
  });

  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "productExpense",
    entityId: xarajat.id,
    after: { productId: params.productId, turi: params.turi, summa: params.summa, qarzga: !!xarajat.debtId },
  });
  return xarajat;
}

/**
 * Xarajatni o'chirish (xato kiritilganda). Naqd xarajat bo'lsa bog'langan
 * chiqim tranzaksiya ham o'chiriladi (soft delete) — kassa qoldig'i to'g'ri qoladi.
 * Qarzga yozilgan xarajat: qarz bo'yicha to'lov bo'lgan bo'lsa o'chirilmaydi.
 */
export async function deleteProductExpense(params: {
  businessId: string;
  expenseId: string;
  userId: string;
}) {
  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const expense = await tx.productExpense.findFirst({
      where: { id: params.expenseId, businessId: params.businessId },
    });
    if (!expense) throw new ForbiddenError("Xarajat topilmadi");

    if (expense.debtId) {
      const debt = await tx.debt.findFirst({
        where: { id: expense.debtId, businessId: params.businessId },
      });
      if (debt && debt.tolangan > 0) {
        throw new BadRequestError("Bu xarajat bo'yicha to'lov qilingan — avval qarzni tekshiring");
      }
      if (debt) await tx.debt.delete({ where: { id: debt.id } });
    }

    if (expense.transactionId) {
      await tx.transaction.updateMany({
        where: { id: expense.transactionId, businessId: params.businessId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }

    await tx.productExpense.delete({ where: { id: expense.id } });
    return { ok: true, summa: expense.summa, productId: expense.productId };
  });

  await logAudit({
    businessId: params.businessId,
    action: "delete",
    entity: "productExpense",
    entityId: params.expenseId,
    before: { productId: natija.productId, summa: natija.summa },
  });
  return { ok: true };
}
