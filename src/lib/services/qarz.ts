import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import { createTransactionTx } from "@/lib/services/transactionService";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { ensureUserKassaTx } from "@/lib/services/userKassa";
import { shaxsiyKassaId } from "@/lib/services/kassaTanlash";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { mijozniAniqlaTx } from "@/lib/services/mijozAniqla";
import { logAudit } from "@/lib/services/audit";
import { todayDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";
import {
  qarzHolatHisobla,
  qarzYopiqmi as yopiqmi,
  type QarzHolat,
  type QarzTolovUsuli,
} from "@/lib/validation/qarz";

/**
 * ZAXIRA KATEGORIYALAR — qarz qaysi kategoriya hisobiga berilgani noma'lum
 * bo'lganda ishlatiladi. Qarzda `categoryId` bo'lsa to'lov AYNAN o'shanga
 * yoziladi (`tolovKategoriyaTx`), aks holda hisobotdagi "Kirim — kategoriya
 * bo'yicha" kesimida butun qarz savdosi bitta ustunga yig'ilib qolardi.
 */
const QARZ_TOLOVI_KATEGORIYA = "Qarz to'lovi";
/** Biz qarzdor bo'lgan qarzni to'laganda — chiqim kategoriyasi. */
const QARZ_TOLASH_KATEGORIYA = "Qarz to'lash";

/** Prisma unique cheklovi buzilganini aniqlaydi (takror to'lov kaliti). */
function unikallikXatosi(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// ---------------------------------------------------------------------------
// Qarz yaratish
// ---------------------------------------------------------------------------

export interface CreateQarzParams {
  businessId: string;
  userId: string;
  turi: "olinadigan" | "beriladigan";
  contactId?: string | null;
  mijozNomi?: string | null;
  mijozTel?: string | null;
  /** Mijoz kartochkasi yaratilsinmi (MIJOZLAR moduli yoqiq bo'lgandagina). */
  mijozSaqla?: boolean;
  jamiSumma: number;
  /** "YYYY-MM-DD". Berilmasa — bugun. */
  sana?: string | null;
  categoryId?: string | null;
  masulId?: string | null;
  productId?: string | null;
  muddat?: string | null;
  izoh?: string | null;
  /**
   * TIZIMGA KIRITILISHIDAN OLDIN to'langan qism (tarixiy qarzni kiritish
   * uchun). Pul allaqachon tizimdan tashqarida olingani uchun bu summa
   * kirim tranzaksiyasi YARATMAYDI — aks holda bir pul ikki marta
   * hisoblanardi. Tizim ichidagi to'lovlar faqat `qarzTolov` orqali.
   */
  tolangan?: number;
}

/**
 * QARZ YARATISH — pul harakati YO'Q.
 *
 * Eng muhim qoida shu funksiyada: qarzga berilgan savdo kirim tranzaksiyasi
 * yaratmaydi. Mahsulot ketdi, pul kelmadi — balans o'zgarmasligi kerak.
 * Kirim faqat `qarzTolov` da, to'lov sanasi bilan yoziladi.
 */
export async function createQarz(params: CreateQarzParams) {
  const sana = params.sana ?? todayDateOnlyString();

  const qarz = await runBusinessTx(params.businessId, async (tx) => {
    const mijoz = await mijozniAniqlaTx(tx, params);

    if (params.categoryId) {
      const cat = await tx.category.findFirst({
        where: { id: params.categoryId, businessId: params.businessId },
        select: { id: true },
      });
      if (!cat) throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
    }
    if (params.productId) {
      const product = await tx.product.findFirst({
        where: { id: params.productId, businessId: params.businessId },
        select: { id: true },
      });
      if (!product) throw new ForbiddenError("Mahsulot topilmadi");
    }

    // Mas'ul — tizim foydalanuvchisi; ismi snapshot sifatida saqlanadi
    // (xodim keyin o'chirilsa ham "kim qarz berdi" savoli javobsiz qolmasin).
    const masul = await tx.user.findFirst({
      where: { id: params.masulId ?? params.userId, tenantId: currentTenantId() },
      select: { id: true, ism: true },
    });

    const tolangan = params.tolangan ?? 0;
    if (tolangan < 0 || tolangan > params.jamiSumma) {
      throw new BadRequestError("To'langan summa qarz summasidan ko'p bo'lmasligi kerak");
    }

    // Mijoz limiti — qarz yozilishidan OLDIN, ayni tranzaksiya ichida
    // (parallel ikki qarz limitdan oshib ketmasin).
    if (params.turi === "olinadigan" && mijoz.contactId) {
      await qarzLimitTekshirTx(tx, params.businessId, mijoz.contactId, params.jamiSumma - tolangan);
    }

    const status = qarzHolatHisobla(params.jamiSumma, tolangan);
    return tx.debt.create({
      data: {
        businessId: params.businessId,
        turi: params.turi,
        contactId: mijoz.contactId ?? undefined,
        mijozNomi: mijoz.ism,
        mijozTel: mijoz.tel ?? undefined,
        jamiSumma: params.jamiSumma,
        tolangan,
        status,
        isYopilgan: yopiqmi(status),
        sana: dateOnlyStringToUTCDate(sana),
        categoryId: params.categoryId || undefined,
        masulId: masul?.id ?? undefined,
        masulIsm: masul?.ism ?? undefined,
        productId: params.productId || undefined,
        muddat: params.muddat ? dateOnlyStringToUTCDate(params.muddat) : undefined,
        izoh: params.izoh?.trim() || undefined,
        userId: params.userId,
      },
    });
  });

  await logAudit({
    businessId: params.businessId,
    action: "create",
    entity: "debt",
    entityId: qarz.id,
    after: {
      turi: qarz.turi,
      mijozNomi: qarz.mijozNomi,
      mijozTel: qarz.mijozTel,
      jamiSumma: qarz.jamiSumma,
      sana,
      status: qarz.status,
      masulIsm: qarz.masulIsm,
    },
  });
  return qarz;
}

// ---------------------------------------------------------------------------
// To'lov
// ---------------------------------------------------------------------------

export interface QarzTolovParams {
  businessId: string;
  debtId: string;
  userId: string;
  summa: number;
  /** "YYYY-MM-DD" — kirim tranzaksiyasi AYNAN shu sana bilan yoziladi. */
  sana?: string | null;
  tolovTuri?: QarzTolovUsuli | null;
  accountId?: string | null;
  izoh?: string | null;
  /** Takror to'lovdan himoya (lib/validation/qarz.ts). */
  idempotencyKey?: string | null;
}

export interface QarzTolovNatija {
  id: string;
  jamiSumma: number;
  tolangan: number;
  qolgan: number;
  status: QarzHolat;
  isYopilgan: boolean;
  /** Shu so'rov haqiqatda yangi to'lov yozdimi (false — takror bosish). */
  yangiTolov: boolean;
  paymentId: string;
  transactionId: string | null;
}

/**
 * QARZ TO'LOVI — pul HAQIQATDA keldi, demak endi kirim yoziladi.
 *
 * Uch narsa bir atomik amalda bo'ladi:
 *   1. `DebtPayment` — to'lov tarixi (sana, usul, kassa, kim qabul qildi);
 *   2. kirim/chiqim tranzaksiyasi — TO'LOV SANASI bilan (qarz berilgan sana
 *      bilan EMAS: 16-avgustda berilgan qarz 20-avgustda to'lansa, kirim
 *      20-avgust hisobotiga tushishi kerak);
 *   3. qarz qoldig'i va holati.
 *
 * Ulardan biri bajarilib ikkinchisi bajarilmasa hisob buziladi — shuning
 * uchun `runBusinessTx`.
 */
export async function qarzTolov(params: QarzTolovParams): Promise<QarzTolovNatija> {
  if (params.summa <= 0) throw new BadRequestError("To'lov summasi musbat bo'lishi kerak");
  const sana = params.sana ?? todayDateOnlyString();

  let natija: QarzTolovNatija;
  try {
    natija = await runBusinessTx(params.businessId, (tx) => tolovTx(tx, params, sana));
  } catch (e) {
    // TAKROR BOSISH POYGASI: ikkita so'rov bir vaqtda o'tib ketsa, ikkinchisi
    // unique kalitga uriladi. Bu XATO EMAS — birinchisi allaqachon yozgan.
    if (unikallikXatosi(e) && params.idempotencyKey) {
      return mavjudTolovNatijasi(params.businessId, params.debtId, params.idempotencyKey);
    }
    throw e;
  }

  if (natija.yangiTolov) {
    await logAudit({
      businessId: params.businessId,
      action: "create",
      entity: "debtPayment",
      entityId: natija.paymentId,
      after: {
        debtId: params.debtId,
        summa: params.summa,
        sana,
        tolovTuri: params.tolovTuri ?? null,
        accountId: params.accountId ?? null,
        transactionId: natija.transactionId,
        tolangan: natija.tolangan,
        qolgan: natija.qolgan,
        status: natija.status,
      },
    });
  }
  return natija;
}

/**
 * KATEGORIYA ATRIBUTSIYASI — qarz to'lovi qaysi kirim kategoriyasiga tushadi.
 *
 * Qarz "Bantik" savdosidan chiqqan bo'lsa, u to'langanda kirim ham AYNAN
 * "Bantik" kategoriyasiga yozilishi kerak: aks holda hisobotdagi "Kirim —
 * kategoriya bo'yicha" kesimida butun qarzga savdo bitta "Qarz to'lovi"
 * ustuniga yig'ilib, mahsulot tahlili yo'qolardi.
 *
 * Qarz kategoriyasi ikki shartda ishlatiladi: u AYNI biznesniki va
 * yo'nalishi to'g'ri (kirimga kirim kategoriyasi, chiqimga chiqim). Chiqim
 * kategoriyasiga kirim yozib qo'yish hisobotni buzardi — bunday holatda
 * zaxira kategoriya ishlaydi.
 */
async function tolovKategoriyaTx(
  tx: BusinessTx,
  businessId: string,
  debtCategoryId: string | null,
  beriladigan: boolean
): Promise<string> {
  const kerakli: "kirim" | "chiqim" = beriladigan ? "chiqim" : "kirim";
  if (debtCategoryId) {
    const cat = await tx.category.findFirst({
      where: { id: debtCategoryId, businessId, turi: kerakli, isActive: true },
      select: { id: true },
    });
    if (cat) return cat.id;
  }
  return ensureCategoryTx(
    tx,
    businessId,
    beriladigan ? QARZ_TOLASH_KATEGORIYA : QARZ_TOLOVI_KATEGORIYA,
    kerakli
  );
}

/** `bittaQarzgaTolovTx` uchun bitta to'lov haqidagi ma'lumot. */
interface BittaTolov {
  summa: number;
  sana: string;
  tolovTuri?: QarzTolovUsuli | null;
  accountId?: string | null;
  izoh?: string | null;
  idempotencyKey?: string | null;
}

/** Bitta qarzga yozilgan to'lovning natijasi (taqsimotdagi bir bo'lak). */
interface TolovBolagi {
  debtId: string;
  paymentId: string;
  transactionId: string | null;
  summa: number;
  qolgan: number;
  status: QarzHolat;
}

/**
 * BITTA QARZGA TO'LOV — pul harakati, to'lov yozuvi va qoldiq bir joyda.
 *
 * Uchala qadam ham chaqiruvchining tranzaksiyasi ICHIDA bajariladi: bitta
 * qarzga to'lov ham (`qarzTolov`), mijozning bir nechta qarzi bo'ylab
 * taqsimlangan to'lov ham (`qarzdorTolov`) aynan shu funksiyaga tayanadi —
 * ikki yo'lda ikki xil buxgalteriya bo'lib qolmasin.
 *
 * Qarzning holati va summasi CHAQIRUVCHIDA tekshirilgan bo'lishi shart
 * (bekor qilinganmi, qolganidan oshmadimi) — bu funksiya yozadi, qaror
 * qabul qilmaydi.
 */
async function bittaQarzgaTolovTx(
  tx: BusinessTx,
  businessId: string,
  userId: string,
  debt: {
    id: string;
    turi: string;
    mijozNomi: string;
    jamiSumma: number;
    tolangan: number;
    categoryId: string | null;
  },
  tolov: BittaTolov
): Promise<TolovBolagi> {
  const beriladigan = debt.turi === "beriladigan";
  const supplierUser = beriladigan ? await taminotchiUserTx(tx, businessId, debt.id) : null;

  let transactionId: string | null = null;
  let accountId: string | null = tolov.accountId ?? null;

  if (supplierUser) {
    // PRO: qarz ICHKI ta'minotchi-user'ga tegishli bo'lsa — to'lov chiqim emas,
    // xaridor kassasidan ta'minotchining shaxsiy kassasiga TRANSFER: pul biznes
    // ichida qoldi, kirim/chiqim sun'iy oshmasligi kerak.
    const tolovchi = await tx.user.findFirst({
      where: { id: userId, tenantId: currentTenantId(), isActive: true },
      select: { id: true, ism: true },
    });
    if (!tolovchi) throw new ForbiddenError("Foydalanuvchi topilmadi");
    const fromAccount = await ensureUserKassaTx(tx, businessId, tolovchi);
    const toAccount = await ensureUserKassaTx(tx, businessId, supplierUser);
    await tx.accountTransfer.create({
      data: {
        businessId,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        summa: tolov.summa,
        valyuta: "UZS",
        sana: dateOnlyStringToUTCDate(tolov.sana),
        izoh: `Qarz to'lash: ${debt.mijozNomi}`,
        userId,
        fromUserId: tolovchi.id,
        fromUserIsm: tolovchi.ism,
        toUserId: supplierUser.id,
        toUserIsm: supplierUser.ism,
        holat: "bajarildi",
        relatedType: "debt",
        relatedId: debt.id,
      },
    });
    accountId = fromAccount.id;
  } else {
    // Kategoriya qarzdan meros qilib olinadi (yuqoridagi izoh).
    const categoryId = await tolovKategoriyaTx(tx, businessId, debt.categoryId, beriladigan);
    // To'lov usuli tranzaksiyaning to'lov turiga o'giriladi: bank ham,
    // Click ham naqdsiz pul — kassa qoldig'ida ikkalasi "click" tarafida.
    const txTolovTuri = tolov.tolovTuri === "naqd" ? "naqd" : tolov.tolovTuri ? "click" : null;
    accountId = await kassaniAniqlaTx(tx, businessId, tolov.accountId, txTolovTuri, userId);
    const txn = await createTransactionTx(tx, userId, businessId, {
      turi: beriladigan ? "chiqim" : "kirim",
      categoryId,
      accountId,
      tolovTuri: txTolovTuri,
      summa: tolov.summa,
      // ENG MUHIM QATOR: kirim TO'LOV sanasi bilan yoziladi.
      sana: tolov.sana,
      izoh:
        tolov.izoh?.trim() ||
        `${beriladigan ? "Qarz to'lash" : "Qarz to'lovi"}: ${debt.mijozNomi}`,
    });
    transactionId = txn.id;
  }

  const payment = await tx.debtPayment.create({
    data: {
      debtId: debt.id,
      businessId,
      summa: tolov.summa,
      sana: dateOnlyStringToUTCDate(tolov.sana),
      tolovTuri: tolov.tolovTuri ?? undefined,
      accountId: accountId ?? undefined,
      izoh: tolov.izoh?.trim() || undefined,
      userId,
      transactionId,
      idempotencyKey: tolov.idempotencyKey ?? undefined,
    },
    select: { id: true },
  });

  // Optimistik qulf: `tolangan` biz o'qigan qiymatda qolgan bo'lsagina yoziladi.
  // Ikki xodim bir vaqtda to'lov kiritsa — ikkinchisi jimgina yo'qolmaydi.
  const yangiTolangan = debt.tolangan + tolov.summa;
  const status = qarzHolatHisobla(debt.jamiSumma, yangiTolangan);
  const upd = await tx.debt.updateMany({
    where: {
      id: debt.id,
      businessId,
      tolangan: debt.tolangan,
      isYopilgan: false,
    },
    data: {
      tolangan: yangiTolangan,
      status,
      isYopilgan: yopiqmi(status),
      updatedBy: userId,
    },
  });
  if (upd.count === 0) {
    throw new BadRequestError("Qarz holati o'zgardi — sahifani yangilab qayta urinib ko'ring");
  }

  return {
    debtId: debt.id,
    paymentId: payment.id,
    transactionId,
    summa: tolov.summa,
    qolgan: debt.jamiSumma - yangiTolangan,
    status,
  };
}

async function tolovTx(
  tx: BusinessTx,
  params: QarzTolovParams,
  sana: string
): Promise<QarzTolovNatija> {
  const debt = await tx.debt.findFirst({
    where: { id: params.debtId, businessId: params.businessId },
  });
  if (!debt) throw new ForbiddenError("Qarz topilmadi");

  // TAKROR BOSISH (oddiy holat): ayni kalit bilan to'lov allaqachon bor.
  if (params.idempotencyKey) {
    const oldingi = await tx.debtPayment.findFirst({
      where: {
        debtId: debt.id,
        businessId: params.businessId,
        idempotencyKey: params.idempotencyKey,
      },
      select: { id: true, transactionId: true },
    });
    if (oldingi) return holatNatijasi(debt, oldingi.id, oldingi.transactionId, false);
  }

  if (debt.status === "CANCELLED") {
    throw new BadRequestError("Bekor qilingan qarzga to'lov qabul qilinmaydi");
  }
  const qolgan = debt.jamiSumma - debt.tolangan;
  if (qolgan <= 0 || debt.isYopilgan) {
    throw new BadRequestError("Bu qarz allaqachon yopilgan");
  }
  if (params.summa > qolgan) {
    throw new BadRequestError("To'lov summasi qolgan qarzdan ko'p");
  }

  const bolak = await bittaQarzgaTolovTx(tx, params.businessId, params.userId, debt, {
    summa: params.summa,
    sana,
    tolovTuri: params.tolovTuri,
    accountId: params.accountId,
    izoh: params.izoh,
    idempotencyKey: params.idempotencyKey,
  });

  return holatNatijasi(
    {
      ...debt,
      tolangan: debt.tolangan + params.summa,
      status: bolak.status,
      isYopilgan: yopiqmi(bolak.status),
    },
    bolak.paymentId,
    bolak.transactionId,
    true
  );
}

function holatNatijasi(
  debt: { id: string; jamiSumma: number; tolangan: number; status: string; isYopilgan: boolean },
  paymentId: string,
  transactionId: string | null,
  yangiTolov: boolean
): QarzTolovNatija {
  return {
    id: debt.id,
    jamiSumma: debt.jamiSumma,
    tolangan: debt.tolangan,
    qolgan: debt.jamiSumma - debt.tolangan,
    status: debt.status as QarzHolat,
    isYopilgan: debt.isYopilgan,
    yangiTolov,
    paymentId,
    transactionId,
  };
}

/** Poyga natijasida yo'qotilgan javobni bazadan qayta o'qiydi. */
async function mavjudTolovNatijasi(
  businessId: string,
  debtId: string,
  idempotencyKey: string
): Promise<QarzTolovNatija> {
  const [debt, payment] = await Promise.all([
    prisma.debt.findFirst({ where: { id: debtId, businessId } }),
    prisma.debtPayment.findFirst({ where: { debtId, businessId, idempotencyKey } }),
  ]);
  if (!debt || !payment) throw new BadRequestError("To'lov holatini o'qib bo'lmadi");
  return holatNatijasi(debt, payment.id, payment.transactionId, false);
}

/**
 * Xarid buyurtmasi orqali ochilgan qarz ta'minotchi-user'ga tegishlimi.
 * Tegishli bo'lsa to'lov chiqim emas, shaxsiy kassalar aro transfer bo'ladi.
 */
async function taminotchiUserTx(
  tx: BusinessTx,
  businessId: string,
  debtId: string
): Promise<{ id: string; ism: string } | null> {
  const order = await tx.purchaseOrder.findFirst({
    where: { debtId, businessId },
    select: { supplierId: true },
  });
  if (!order) return null;
  const sup = await tx.supplier.findFirst({
    where: { id: order.supplierId, businessId },
    select: { userId: true },
  });
  if (!sup?.userId) return null;
  return tx.user.findFirst({
    where: { id: sup.userId, tenantId: currentTenantId(), isActive: true },
    select: { id: true, ism: true },
  });
}

/**
 * To'lov uchun kassa: tanlangani tekshiriladi, tanlanmagani — to'lov turiga
 * mos birinchi faol kassa. `resolveAccountId` ning tranzaksiya ichidagi
 * varianti (xom `tx`, shuning uchun `businessId` qo'lda).
 */
async function kassaniAniqlaTx(
  tx: BusinessTx,
  businessId: string,
  accountId: string | null | undefined,
  tolovTuri: string | null,
  userId?: string | null
): Promise<string | null> {
  if (accountId) {
    const acc = await tx.account.findFirst({
      where: { id: accountId, businessId, isActive: true },
      select: { id: true },
    });
    if (!acc) throw new ForbiddenError("Kassa topilmadi yoki nofaol");
    return acc.id;
  }
  // Shaxsiy kassa rejimi: naqd qarz to'lovi to'lovni QABUL QILGAN xodimning
  // kassasiga tushadi (odatdagi naqd yozuv bilan bir xil qoida).
  const shaxsiy = await shaxsiyKassaId(tx, businessId, userId, tolovTuri);
  if (shaxsiy) return shaxsiy;
  if (tolovTuri === "naqd" || tolovTuri === "click") {
    const mosTurlar = tolovTuri === "naqd" ? ["naqd"] : ["plastik", "bank"];
    const mos = await tx.account.findFirst({
      where: { businessId, isActive: true, turi: { in: mosTurlar } },
      orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (mos) return mos.id;
  }
  const birinchi = await tx.account.findFirst({
    where: { businessId, isActive: true },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return birinchi?.id ?? null;
}

// ---------------------------------------------------------------------------
// Mijoz bo'yicha to'lov — bir nechta qarz ustiga taqsimlash
// ---------------------------------------------------------------------------

/**
 * TAQSIMLASH QOIDASI (yangi biznes qoidasi, 2026-08).
 *
 * Bir mijozda bir nechta ochiq qarz bo'lsa, bitta to'lov qaysi qarzni
 * yopadi degan savolga ilgari javob YO'Q edi: xodim qarzni qo'lda tanlardi,
 * tanlamasa hech narsa bo'lmasdi. Endi qoida aniq va hujjatlangan:
 *
 *   ENG ESKI OCHIQ QARZDAN BOSHLAB (`sana` bo'yicha, teng bo'lsa
 *   `createdAt` bo'yicha) to'lov ketma-ket to'ldiriladi.
 *
 * Masalan A(500k, 10-avg), B(1m, 15-avg), C(2m, 20-avg) va 1,2 mln to'lov:
 *   A → 500k (yopildi), B → 700k (300k qoldi), C → tegilmadi.
 *
 * Nega eng eskisidan: eski qarz eng ko'p kechikkan va undirish ehtimoli eng
 * past qarz — pul kelganda birinchi navbatda o'sha yopiladi. Bu buxgalteriya
 * amaliyotidagi odatiy FIFO taqsimoti.
 *
 * QO'LDA TAQSIMLASH ham qoladi: `taqsimot` berilsa aynan o'sha bo'yicha
 * yoziladi (xodim "bu pul aynan shu savdo uchun" deb bilsa). Avtomatik
 * qoida faqat tanlov qilinmagan holatga.
 */
export type QarzTaqsimotUsuli = "eng-eski" | "qolda";

export interface QarzdorTolovParams {
  businessId: string;
  userId: string;
  turi: "olinadigan" | "beriladigan";
  /** `qarzdorKalit()` natijasi — "contact:<id>" yoki "ism:<kichik harf>". */
  kalit: string;
  summa: number;
  /** "YYYY-MM-DD" — kirim/chiqim AYNAN shu sana bilan yoziladi. */
  sana?: string | null;
  tolovTuri?: QarzTolovUsuli | null;
  accountId?: string | null;
  izoh?: string | null;
  idempotencyKey?: string | null;
  /**
   * QO'LDA TAQSIMLASH: qaysi qarzga qancha. Berilsa yig'indisi `summa` ga
   * teng bo'lishi SHART — aks holda pul yo'qoladi yoki ikki marta yoziladi.
   */
  taqsimot?: { debtId: string; summa: number }[] | null;
}

export interface QarzdorTolovNatija {
  /** Haqiqatda yozilgan jami summa. */
  summa: number;
  /** Taqsimot: qaysi qarzga qancha tushdi va qanchasi qoldi. */
  bolaklar: TolovBolagi[];
  /** Shu qarzdorning to'lovdan KEYINGI umumiy qoldig'i. */
  qolgan: number;
  /** Nechta qarz shu to'lov bilan to'liq yopildi. */
  yopilganSoni: number;
  /** Shu so'rov haqiqatda yangi to'lov yozdimi (false — takror bosish). */
  yangiTolov: boolean;
  usul: QarzTaqsimotUsuli;
}

/** Qarzdorning ochiq qarzlarini eng eskisidan boshlab o'qiydi. */
async function qarzdorOchiqQarzlariTx(
  tx: BusinessTx,
  businessId: string,
  turi: string,
  kalit: string
) {
  const contactId = kalit.startsWith("contact:") ? kalit.slice("contact:".length) : null;
  const ismKalit = kalit.startsWith("ism:") ? kalit.slice("ism:".length) : null;
  if (!contactId && !ismKalit) throw new BadRequestError("Qarzdor kaliti noto'g'ri");

  // Tranzaksiya ichida xom `tx` ishlatiladi — `businessId` sharti QO'LDA.
  const hammasi = await tx.debt.findMany({
    where: {
      businessId,
      turi,
      isYopilgan: false,
      ...(contactId ? { contactId } : { contactId: null }),
    },
    orderBy: [{ sana: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      turi: true,
      mijozNomi: true,
      jamiSumma: true,
      tolangan: true,
      categoryId: true,
      status: true,
    },
  });

  // Kartochkasiz qarzdor ism bo'yicha birlashadi — `qarzdorKalit()` bilan
  // AYNI qoida (registr va chetdagi bo'shliqlar farqi hisobga olinmaydi).
  const debts = ismKalit
    ? hammasi.filter((d) => d.mijozNomi.trim().toLowerCase() === ismKalit)
    : hammasi;

  return debts.filter((d) => d.status !== "CANCELLED" && d.jamiSumma - d.tolangan > 0);
}

/**
 * MIJOZ BO'YICHA TO'LOV — bitta summa, bir nechta qarz, BITTA tranzaksiya.
 *
 * Har qarz uchun ALOHIDA `DebtPayment` va ALOHIDA kirim yoziladi. Bu ataylab:
 * 1,2 mln to'lov uchta turli kategoriyadagi qarzni yopsa, kirim ham uchga
 * bo'linib har biri o'z kategoriyasiga tushadi (10-talab). Bitta yirik
 * yozuv qilib qo'yish kategoriya kesimini yolg'onga aylantirardi.
 *
 * Hammasi bitta `runBusinessTx` ichida: taqsimotning yarmi yozilib yarmi
 * yozilmay qolishi — hisobning buzilishi.
 */
export async function qarzdorTolov(params: QarzdorTolovParams): Promise<QarzdorTolovNatija> {
  if (params.summa <= 0) throw new BadRequestError("To'lov summasi musbat bo'lishi kerak");
  if (!Number.isInteger(params.summa)) {
    throw new BadRequestError("To'lov summasi butun son bo'lishi kerak");
  }
  const sana = params.sana ?? todayDateOnlyString();

  let natija: QarzdorTolovNatija;
  try {
    natija = await runBusinessTx(params.businessId, (tx) => qarzdorTolovTx(tx, params, sana));
  } catch (e) {
    // TAKROR BOSISH POYGASI: ikki so'rov bir vaqtda o'tsa ikkinchisi unique
    // kalitga uriladi. Bu xato emas — birinchisi allaqachon yozgan.
    if (unikallikXatosi(e) && params.idempotencyKey) {
      return mavjudQarzdorTolovi(params);
    }
    throw e;
  }

  if (natija.yangiTolov) {
    await logAudit({
      businessId: params.businessId,
      action: "create",
      entity: "debtPayment",
      entityId: natija.bolaklar[0]?.paymentId ?? params.kalit,
      after: {
        qarzdor: params.kalit,
        turi: params.turi,
        summa: natija.summa,
        sana,
        tolovTuri: params.tolovTuri ?? null,
        accountId: params.accountId ?? null,
        usul: natija.usul,
        taqsimot: natija.bolaklar.map((b) => ({
          debtId: b.debtId,
          summa: b.summa,
          qolgan: b.qolgan,
          status: b.status,
          transactionId: b.transactionId,
        })),
        yopilganSoni: natija.yopilganSoni,
        qolgan: natija.qolgan,
      },
    });
  }
  return natija;
}

async function qarzdorTolovTx(
  tx: BusinessTx,
  params: QarzdorTolovParams,
  sana: string
): Promise<QarzdorTolovNatija> {
  const debts = await qarzdorOchiqQarzlariTx(tx, params.businessId, params.turi, params.kalit);
  if (debts.length === 0) throw new BadRequestError("Bu qarzdorda ochiq qarz yo'q");

  // TAKROR BOSISH: ayni kalit bilan shu qarzdorning qarzlariga to'lov
  // allaqachon yozilganmi. Tekshiruv taqsimotdan OLDIN, chunki birinchi
  // so'rov qarz qoldiqlarini o'zgartirib yuborgan bo'ladi va ikkinchi
  // so'rov boshqa taqsimot hisoblab, uni yangi to'lov deb yozib yuborardi.
  if (params.idempotencyKey) {
    const oldingi = await mavjudBolaklarTx(tx, params);
    if (oldingi) return oldingi;
  }

  const taqsimot = params.taqsimot?.length
    ? qoldaTaqsimla(params.taqsimot, debts, params.summa)
    : engEskidanTaqsimla(debts, params.summa);

  const bolaklar: TolovBolagi[] = [];
  for (const t of taqsimot) {
    const debt = debts.find((d) => d.id === t.debtId);
    if (!debt) throw new BadRequestError("Qarz topilmadi");
    bolaklar.push(
      await bittaQarzgaTolovTx(tx, params.businessId, params.userId, debt, {
        summa: t.summa,
        sana,
        tolovTuri: params.tolovTuri,
        accountId: params.accountId,
        izoh: params.izoh,
        idempotencyKey: params.idempotencyKey,
      })
    );
  }

  const jamiQoldiq = debts.reduce((acc, d) => acc + (d.jamiSumma - d.tolangan), 0);
  return {
    summa: bolaklar.reduce((acc, b) => acc + b.summa, 0),
    bolaklar,
    qolgan: jamiQoldiq - params.summa,
    yopilganSoni: bolaklar.filter((b) => b.qolgan === 0).length,
    yangiTolov: true,
    usul: params.taqsimot?.length ? "qolda" : "eng-eski",
  };
}

/**
 * ENG ESKI OCHIQ QARZDAN BOSHLAB taqsimlash (standart qoida).
 *
 * OVERPAYMENT JIM QABUL QILINMAYDI: qarzdorning jami qoldig'idan ortiq
 * summa aniq xato bilan rad etiladi. Yashirin avans/kredit balansi ataylab
 * yaratilmaydi — tizimda bunday konsepsiya yo'q, uni jimgina o'ylab
 * chiqarish pulni ko'rinmas joyga yashirish bo'lardi.
 */
function engEskidanTaqsimla(
  debts: { id: string; jamiSumma: number; tolangan: number }[],
  summa: number
): { debtId: string; summa: number }[] {
  const jami = debts.reduce((acc, d) => acc + (d.jamiSumma - d.tolangan), 0);
  if (summa > jami) {
    throw new BadRequestError(
      "To'lov summasi mijozning jami qarzidan ko'p — summani tekshiring"
    );
  }

  const natija: { debtId: string; summa: number }[] = [];
  let qoldi = summa;
  for (const d of debts) {
    if (qoldi <= 0) break;
    const qolgan = d.jamiSumma - d.tolangan;
    const ulush = Math.min(qoldi, qolgan);
    natija.push({ debtId: d.id, summa: ulush });
    qoldi -= ulush;
  }
  return natija;
}

/** Qo'lda berilgan taqsimotni tekshiradi (yig'indi, qoldiq, egalik). */
function qoldaTaqsimla(
  taqsimot: { debtId: string; summa: number }[],
  debts: { id: string; jamiSumma: number; tolangan: number }[],
  summa: number
): { debtId: string; summa: number }[] {
  const korilgan = new Set<string>();
  let yigindi = 0;
  for (const t of taqsimot) {
    if (!Number.isInteger(t.summa) || t.summa <= 0) {
      throw new BadRequestError("Taqsimotdagi har summa musbat butun son bo'lishi kerak");
    }
    if (korilgan.has(t.debtId)) {
      throw new BadRequestError("Bitta qarz taqsimotda ikki marta ko'rsatilgan");
    }
    korilgan.add(t.debtId);
    const debt = debts.find((d) => d.id === t.debtId);
    if (!debt) throw new BadRequestError("Taqsimotdagi qarz bu mijozda ochiq emas");
    if (t.summa > debt.jamiSumma - debt.tolangan) {
      throw new BadRequestError("Taqsimotdagi summa qarz qoldig'idan ko'p");
    }
    yigindi += t.summa;
  }
  if (yigindi !== summa) {
    throw new BadRequestError("Taqsimot yig'indisi to'lov summasiga teng emas");
  }
  return taqsimot;
}

/**
 * Shu kalit bilan allaqachon yozilgan to'lov bo'laklarini qaytaradi.
 * Topilmasa `null` — demak bu yangi to'lov.
 */
async function mavjudBolaklarTx(
  tx: BusinessTx,
  params: QarzdorTolovParams
): Promise<QarzdorTolovNatija | null> {
  const debtIds = (
    await tx.debt.findMany({
      where: {
        businessId: params.businessId,
        turi: params.turi,
        ...(params.kalit.startsWith("contact:")
          ? { contactId: params.kalit.slice("contact:".length) }
          : { contactId: null }),
      },
      select: { id: true, mijozNomi: true },
    })
  )
    .filter((d) =>
      params.kalit.startsWith("ism:")
        ? d.mijozNomi.trim().toLowerCase() === params.kalit.slice("ism:".length)
        : true
    )
    .map((d) => d.id);
  if (debtIds.length === 0) return null;

  const oldingi = await tx.debtPayment.findMany({
    where: {
      businessId: params.businessId,
      debtId: { in: debtIds },
      idempotencyKey: params.idempotencyKey,
    },
    select: { id: true, debtId: true, summa: true, transactionId: true },
  });
  if (oldingi.length === 0) return null;

  const debts = await tx.debt.findMany({
    where: { businessId: params.businessId, id: { in: oldingi.map((p) => p.debtId) } },
    select: { id: true, jamiSumma: true, tolangan: true, status: true },
  });
  const holat = new Map(debts.map((d) => [d.id, d]));

  const bolaklar: TolovBolagi[] = oldingi.map((p) => {
    const d = holat.get(p.debtId);
    return {
      debtId: p.debtId,
      paymentId: p.id,
      transactionId: p.transactionId,
      summa: p.summa,
      qolgan: d ? d.jamiSumma - d.tolangan : 0,
      status: (d?.status as QarzHolat) ?? "OPEN",
    };
  });

  const ochiq = await qarzdorOchiqQarzlariTx(
    tx,
    params.businessId,
    params.turi,
    params.kalit
  );
  return {
    summa: bolaklar.reduce((acc, b) => acc + b.summa, 0),
    bolaklar,
    qolgan: ochiq.reduce((acc, d) => acc + (d.jamiSumma - d.tolangan), 0),
    yopilganSoni: bolaklar.filter((b) => b.qolgan === 0).length,
    yangiTolov: false,
    usul: params.taqsimot?.length ? "qolda" : "eng-eski",
  };
}

/** Poyga natijasida yo'qotilgan javobni bazadan qayta o'qiydi. */
async function mavjudQarzdorTolovi(params: QarzdorTolovParams): Promise<QarzdorTolovNatija> {
  const natija = await runBusinessTx(params.businessId, (tx) => mavjudBolaklarTx(tx, params));
  if (!natija) throw new BadRequestError("To'lov holatini o'qib bo'lmadi");
  return natija;
}

// ---------------------------------------------------------------------------
// Bekor qilish
// ---------------------------------------------------------------------------

/**
 * QARZNI BEKOR QILISH — masalan xato kiritilgan yoki mahsulot qaytarilgan.
 *
 * Yozuv O'CHIRILMAYDI: kim, qachon, nega bekor qilgani saqlanadi. To'lovi
 * bo'lgan qarzni bekor qilib bo'lmaydi — u holda allaqachon yozilgan kirim
 * yolg'onga aylanardi; avval to'lovni tuzatish kerak.
 */
export async function qarzBekor(params: {
  businessId: string;
  debtId: string;
  userId: string;
  sabab: string;
}) {
  const qarz = await runBusinessTx(params.businessId, async (tx) => {
    const debt = await tx.debt.findFirst({
      where: { id: params.debtId, businessId: params.businessId },
    });
    if (!debt) throw new ForbiddenError("Qarz topilmadi");
    if (debt.status === "CANCELLED") throw new BadRequestError("Bu qarz allaqachon bekor qilingan");
    if (debt.tolangan > 0) {
      throw new BadRequestError(
        "To'lovi qabul qilingan qarzni bekor qilib bo'lmaydi — avval to'lovlarni tuzating"
      );
    }

    const upd = await tx.debt.updateMany({
      where: { id: debt.id, businessId: params.businessId, tolangan: 0, isYopilgan: false },
      data: {
        status: "CANCELLED",
        isYopilgan: true,
        cancelledAt: new Date(),
        cancelledBy: params.userId,
        cancelReason: params.sabab.trim(),
        updatedBy: params.userId,
      },
    });
    if (upd.count === 0) {
      throw new BadRequestError("Qarz holati o'zgardi — sahifani yangilab qayta urinib ko'ring");
    }
    return tx.debt.findUniqueOrThrow({ where: { id: debt.id } });
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "debt",
    entityId: qarz.id,
    after: { status: "CANCELLED", sabab: params.sabab, mijozNomi: qarz.mijozNomi },
  });
  return qarz;
}
