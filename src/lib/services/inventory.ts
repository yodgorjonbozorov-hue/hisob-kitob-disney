import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { createTransactionTx } from "@/lib/services/transactionService";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import { ensureUserKassaTx } from "@/lib/services/userKassa";
import { todayDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";
import { isAvto, isOptom } from "@/lib/biznesTuri";
import { logAudit } from "@/lib/services/audit";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { mijozniAniqlaTx } from "@/lib/services/mijozAniqla";
import { qarzHolatHisobla } from "@/lib/validation/qarz";
import { kategoriyaIdTop } from "@/lib/kategoriyaNom";

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
 * REGISTRGA BEFARQ IZLASH (`kategoriyaIdTop`): foydalanuvchi qo'lda "sotuv"
 * yaratib qo'ygan bo'lsa, bu yerda "Sotuv" QAYTA yaratilmaydi — aks holda
 * bazaning registrsiz unique indeksiga urilib savdoning O'ZI yiqilardi.
 *
 * Yaratish `upsert` bo'lib qoladi: eski `findFirst → create` ketma-ketligi
 * ikkita parallel sotuvda `@@unique([nomi, turi, businessId])` ni buzib
 * 500 xato berardi.
 */
export async function ensureCategoryTx(
  tx: BusinessTx,
  businessId: string,
  nomi: string,
  turi: "kirim" | "chiqim" = "kirim"
): Promise<string> {
  return kategoriyaIdTop(
    () => tx.category.findMany({ where: { businessId, turi }, select: { id: true, nomi: true } }),
    () =>
      tx.category.upsert({
        where: { nomi_turi_businessId: { nomi, turi, businessId } },
        update: {},
        create: { businessId, nomi, turi },
        select: { id: true },
      }),
    nomi
  );
}

/** Tranzaksiyadan tashqarida chaqirish uchun (bot, eski chaqiruvchilar). */
export async function ensureCategory(
  businessId: string,
  nomi: string,
  turi: "kirim" | "chiqim" = "kirim"
): Promise<string> {
  return kategoriyaIdTop(
    () =>
      prisma.category.findMany({ where: { businessId, turi }, select: { id: true, nomi: true } }),
    () => prisma.category.create({ data: { businessId, nomi, turi }, select: { id: true } }),
    nomi
  );
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
/** Savatdagi bitta qator — bir mahsulot va uning miqdori. */
export interface SotuvQatori {
  productId: string;
  miqdor: number;
  /** Kelishilgan birlik narxi. Berilmasa mahsulotning sotuv narxi olinadi. */
  narx?: number | null;
}

/** Sotuvning MIJOZ va TO'LOV qismi — savatdagi hamma qatorga bir xil tegishli. */
export interface SotuvUmumiy {
  businessId: string;
  tolovTuri: "naqd" | "qarz";
  /** Mijoz kartochkasi (ixtiyoriy). Berilsa qarz limiti tekshiriladi. */
  contactId?: string | null;
  mijozNomi?: string | null;
  mijozTel?: string | null;
  /** Mijoz kartochkasi yaratilsinmi (MIJOZLAR moduli yoqiq bo'lgandagina). */
  mijozSaqla?: boolean;
  /** Naqd sotuvda pul tushadigan kassa (naqd/Click/terminal). Berilmasa — standart kassa. */
  accountId?: string | null;
  /** Sotuv sanasi "YYYY-MM-DD". Berilmasa bugun (kechagi sotuvni ham kiritish mumkin). */
  sana?: string | null;
  userId: string;
}

/** Aniqlangan mijoz — savatdagi barcha qatorlar uchun BIR MARTA hisoblanadi. */
type SotuvMijozi = { contactId: string | null; ism: string | null; tel: string | null };

/**
 * BITTA QATORNI YOZISH — chaqiruvchining tranzaksiyasi ICHIDA.
 *
 * Bitta mahsulotli sotuv ham (`createSale`), savatli sotuv ham
 * (`createSaleKop`) AYNI shu funksiyaga tayanadi — ikki yo'lda ikki xil
 * buxgalteriya bo'lib qolmasin. Mijoz va biznes turi CHAQIRUVCHIDA bir
 * marta aniqlanadi va shu yerga tayyor holda uzatiladi.
 */
async function bittaSotuvTx(
  tx: BusinessTx,
  umumiy: SotuvUmumiy,
  qator: SotuvQatori,
  mijoz: SotuvMijozi,
  biznesTuri: string | undefined,
  sana: string
) {
  const product = await tx.product.findFirst({
    where: { id: qator.productId, businessId: umumiy.businessId, isActive: true },
  });
  if (!product) throw new ForbiddenError("Mahsulot topilmadi");

  const kelishilganNarx = qator.narx && qator.narx > 0 ? Math.round(qator.narx) : null;
  if (!kelishilganNarx && product.sotuvNarx <= 0) {
    throw new BadRequestError(`Sotuv narxi kiritilmagan: ${product.nomi}`);
  }

  // Qarz limiti — qoldiq kamaytirilishidan OLDIN tekshiriladi, shu bilan
  // limitdan oshgan sotuv omborga umuman tegmaydi (tranzaksiya orqaga
  // qaytadi, lekin tartib baribir aniq bo'lgani ma'qul).
  if (umumiy.tolovTuri === "qarz" && mijoz.contactId) {
    const narx = kelishilganNarx && kelishilganNarx > 0 ? kelishilganNarx : product.sotuvNarx;
    await qarzLimitTekshirTx(tx, umumiy.businessId, mijoz.contactId, narx * qator.miqdor);
  }

  // Atomik shartli kamaytirish — yetarli qoldiq bo'lsagina bajariladi.
  const upd = await tx.product.updateMany({
    where: { id: product.id, businessId: umumiy.businessId, miqdor: { gte: qator.miqdor } },
    data: { miqdor: { decrement: qator.miqdor } },
  });
  if (upd.count === 0) {
    throw new BadRequestError(`Omborda yetarli emas: ${product.nomi}`);
  }

  const birlikNarx = kelishilganNarx ?? product.sotuvNarx;
  const tannarx = product.kelganNarx;
  const jamiSumma = birlikNarx * qator.miqdor;

  // AVTO rejimida kelishilgan narx kartochkaga yoziladi: bitta yozuv = bitta
  // mashina, narx esa har doim savdolashib belgilanadi.
  //
  // Oddiy omborda esa BU HALOKATLI edi (H-1): 500 dona tovardan bittasini
  // chegirma bilan sotsangiz butun katalog narxi o'zgarib ketardi va keyingi
  // barcha sotuvlar chegirma narxida ketardi. Shuning uchun endi faqat avto.
  if (isAvto(biznesTuri) && kelishilganNarx && kelishilganNarx !== product.sotuvNarx) {
    await tx.product.update({
      where: { id: product.id },
      data: { sotuvNarx: kelishilganNarx },
    });
  }

  const sale = await tx.sale.create({
    data: {
      businessId: umumiy.businessId,
      productId: product.id,
      miqdor: qator.miqdor,
      birlikNarx,
      tannarx,
      jamiSumma,
      tolovTuri: umumiy.tolovTuri,
      contactId: mijoz.contactId ?? undefined,
      mijozNomi: mijoz.ism ?? undefined,
      mijozTel: mijoz.tel ?? undefined,
      sana: dateOnlyStringToUTCDate(sana),
      userId: umumiy.userId,
    },
  });

  if (umumiy.tolovTuri === "naqd") {
    // Naqd sotuv — darhol kirim tranzaksiya (kassa usuli).
    const categoryId = await ensureCategoryTx(tx, umumiy.businessId, SOTUV_KATEGORIYA);
    const txn = await createTransactionTx(tx, umumiy.userId, umumiy.businessId, {
      turi: "kirim",
      categoryId,
      accountId: umumiy.accountId ?? undefined,
      summa: jamiSumma,
      sana,
      izoh: `${product.nomi} × ${qator.miqdor}`,
    });
    await tx.sale.update({ where: { id: sale.id }, data: { transactionId: txn.id } });
  } else {
    // Qarz — daromad yozilmaydi, qarzdorlik yaratiladi (bizga qarzdor).
    // Kirim faqat to'lov qabul qilinganda, TO'LOV SANASI bilan yoziladi
    // (lib/services/qarz.ts).
    //
    // HAR QATOR — O'Z QARZI: `Debt.saleId` UNIQUE va `productId` bilan
    // bog'langan, ya'ni model "bir sotuv = bir qarz" deb qurilgan. Savatdagi
    // qatorlar bir mijozga tegishli bo'lgani uchun ular baribir bitta
    // qarzdor ostida jamlanadi va to'lov ular bo'ylab FIFO taqsimlanadi
    // (lib/services/qarz.ts).
    await tx.debt.create({
      data: {
        businessId: umumiy.businessId,
        turi: "olinadigan",
        saleId: sale.id,
        productId: product.id,
        contactId: mijoz.contactId ?? undefined,
        mijozNomi: mijoz.ism!,
        mijozTel: mijoz.tel ?? undefined,
        jamiSumma,
        status: "OPEN",
        sana: dateOnlyStringToUTCDate(sana),
        userId: umumiy.userId,
      },
    });
  }

  return tx.sale.findUniqueOrThrow({
    where: { id: sale.id },
    include: { product: { select: { nomi: true } } },
  });
}

/**
 * SAVATDAGI QATORLARNI BIRLASHTIRISH.
 *
 * Foydalanuvchi bitta mahsulotni ikki marta tanlasa (yoki qidiruvdan
 * qayta qo'shsa) ikkita alohida sotuv yozilmaydi — miqdor QO'SHILADI.
 * Narx birinchi kiritilgani bo'yicha qoladi: keyingi qator narxsiz
 * kelsa avvalgisi buzilmasligi kerak.
 *
 * Sof funksiya — server ham, brauzer ham ayni qoidadan yuradi.
 */
export function savatniBirlashtir(qatorlar: SotuvQatori[]): SotuvQatori[] {
  const xarita = new Map<string, SotuvQatori>();
  for (const q of qatorlar) {
    const bor = xarita.get(q.productId);
    if (bor) {
      bor.miqdor += q.miqdor;
      if (bor.narx == null && q.narx != null) bor.narx = q.narx;
    } else {
      xarita.set(q.productId, { ...q });
    }
  }
  return [...xarita.values()];
}

/** Sotuv uchun mijoz va biznes turini bir marta aniqlaydi (savat bo'ylab bir xil). */
async function sotuvKontekstiTx(tx: BusinessTx, umumiy: SotuvUmumiy) {
  if (umumiy.tolovTuri === "qarz" && !umumiy.contactId && !umumiy.mijozNomi?.trim()) {
    throw new BadRequestError("Qarzga sotishda mijoz nomi kiritilishi shart");
  }

  // Biznes turi bu yerda o'qiladi: "avto" — narx kartochkaga yoziladi,
  // "optom" — mijozsiz sotuv o'tmaydi (server qoidasi, frontendga ishonilmaydi).
  const biznes = await tx.business.findFirst({
    where: { id: umumiy.businessId },
    select: { turi: true },
  });
  const mijozBerilgan = Boolean(umumiy.contactId || umumiy.mijozNomi?.trim());
  if (isOptom(biznes?.turi) && !mijozBerilgan) {
    throw new BadRequestError("Optom sotuvda mijoz tanlanishi shart — kim xarid qilganini yozing");
  }

  // MIJOZ — mijoz berilgan har qanday sotuvda kartochka BITTA joyda
  // aniqlanadi (lib/services/mijozAniqla.ts): egalik tekshiriladi, dublikat
  // yaratilmaydi. Savatda bu BIR MARTA bajariladi — har qator uchun qayta
  // aniqlansa bitta mijozdan bir necha kartochka paydo bo'lish xavfi bor.
  const mijoz: SotuvMijozi = mijozBerilgan
    ? await mijozniAniqlaTx(tx, {
        businessId: umumiy.businessId,
        userId: umumiy.userId,
        contactId: umumiy.contactId,
        mijozNomi: umumiy.mijozNomi,
        mijozTel: umumiy.mijozTel,
        mijozSaqla: umumiy.mijozSaqla,
      })
    : { contactId: null, ism: null, tel: null };

  return { mijoz, biznesTuri: biznes?.turi };
}

/**
 * KO'P MAHSULOTLI SOTUV — savat BITTA atomik amalda yoziladi.
 *
 * Nega atomik: kassir 6 ta mahsulotni tanlab "Sotuvni yakunlash"ni bosganda
 * to'rttasi yozilib, beshinchisida ombor yetmay qolsa — ombor ham, kassa ham
 * yarim holatda qolardi va uni qo'lda tuzatish kerak bo'lardi. Endi yo
 * hammasi yoziladi, yo hech nimasi.
 *
 * Bitta mahsulotli sotuv ham shu yo'ldan o'tadi (`createSale` — bitta
 * qatorli savat), shuning uchun ikkinchi buxgalteriya yo'q.
 */
export async function createSaleKop(umumiy: SotuvUmumiy, qatorlar: SotuvQatori[]) {
  const savat = savatniBirlashtir(qatorlar);
  if (savat.length === 0) throw new BadRequestError("Savat bo'sh — mahsulot tanlang");
  for (const q of savat) {
    if (!Number.isInteger(q.miqdor) || q.miqdor <= 0) {
      throw new BadRequestError("Miqdor butun va noldan katta bo'lishi kerak");
    }
  }

  const sana = umumiy.sana ?? todayDateOnlyString();
  const sotuvlar = await runBusinessTx(umumiy.businessId, async (tx) => {
    const { mijoz, biznesTuri } = await sotuvKontekstiTx(tx, umumiy);
    const natija = [];
    for (const q of savat) {
      natija.push(await bittaSotuvTx(tx, umumiy, q, mijoz, biznesTuri, sana));
    }
    return natija;
  });

  await logAudit({
    businessId: umumiy.businessId,
    action: "create",
    entity: "sale",
    entityId: sotuvlar[0]?.id ?? "?",
    after: {
      qatorlar: sotuvlar.map((s) => ({
        id: s.id,
        productId: s.productId,
        miqdor: s.miqdor,
        jamiSumma: s.jamiSumma,
      })),
      jami: sotuvlar.reduce((a, s) => a + s.jamiSumma, 0),
      tolovTuri: umumiy.tolovTuri,
      mijozNomi: sotuvlar[0]?.mijozNomi ?? null,
    },
  });
  return sotuvlar;
}

/**
 * BITTA MAHSULOTLI SOTUV — eski chaqiruvchilar (bot, POS, testlar) uchun
 * o'zgarmagan imzo. Ichkarida savatli yo'ldan o'tadi.
 */
export async function createSale(params: SotuvUmumiy & SotuvQatori) {
  const { productId, miqdor, narx, ...umumiy } = params;
  const sotuvlar = await createSaleKop(umumiy, [{ productId, miqdor, narx }]);
  return sotuvlar[0];
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

  const natija = await runBusinessTx(params.businessId, async (tx) => {
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
    if (sale.transactionId) {
      await tx.transaction.updateMany({
        where: { id: sale.transactionId, businessId: params.businessId, deletedAt: null },
        data: { deletedAt: new Date() },
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

    return { productId: sale.productId, miqdor: sale.miqdor, jamiSumma: sale.jamiSumma };
  });

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
 * QARZ TO'LOVI shu fayldan `lib/services/qarz.ts` ga ko'chirildi.
 *
 * Sabab: to'lov endi sana, to'lov usuli, kassa va takror bosishdan himoya
 * kabi qarzga xos qoidalarni o'z ichiga oladi — bular ombor mantig'i emas.
 * Chaqirish: `qarzTolov({ businessId, debtId, summa, ... })`.
 */

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
  /** Qarz berilgan sana "YYYY-MM-DD". Berilmasa — bugun. */
  sana?: string | null;
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

  // Holat yagona joydan chiqadi — `status` hech qayerda qo'lda yozilmaydi.
  const status = qarzHolatHisobla(params.jamiSumma, tolangan);
  return tx.debt.create({
    data: {
      businessId: params.businessId,
      turi: params.turi,
      mijozNomi: nomi,
      mijozTel: params.mijozTel?.trim() || undefined,
      jamiSumma: params.jamiSumma,
      tolangan,
      status,
      isYopilgan: status === "PAID",
      sana: dateOnlyStringToUTCDate(params.sana ?? todayDateOnlyString()),
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
        sana: todayDateOnlyString(),
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
        sana: todayDateOnlyString(),
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
