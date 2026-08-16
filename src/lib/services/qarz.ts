import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import { createTransactionTx } from "@/lib/services/transactionService";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { ensureUserKassaTx } from "@/lib/services/userKassa";
import { qarzLimitTekshirTx } from "@/lib/services/mijoz";
import { logAudit } from "@/lib/services/audit";
import { todayDateOnlyString, dateOnlyStringToUTCDate } from "@/lib/date";
import {
  qarzHolatHisobla,
  qarzYopiqmi as yopiqmi,
  type QarzHolat,
  type QarzTolovUsuli,
} from "@/lib/validation/qarz";

/** Bizga qarzdor mijoz to'laganda ochiladigan kirim kategoriyasi. */
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

/**
 * Mijozni aniqlaydi: mavjud kartochka, yangi kartochka yoki faqat ism+telefon.
 *
 * `mijozSaqla` bayrog'ini API qatlami MIJOZLAR moduli holatiga qarab beradi —
 * o'chirilgan modul uchun kartochka yaratilmasin.
 */
async function mijozniAniqlaTx(
  tx: BusinessTx,
  params: CreateQarzParams
): Promise<{ contactId: string | null; ism: string; tel: string | null }> {
  if (params.contactId) {
    const contact = await tx.contact.findFirst({
      where: { id: params.contactId, businessId: params.businessId, deletedAt: null },
      select: { id: true, ism: true, tel: true },
    });
    if (!contact) throw new ForbiddenError("Mijoz topilmadi");
    // Formada telefon to'ldirilgan va kartochkada yo'q bo'lsa — kartochka
    // to'ldiriladi (mijoz ma'lumoti saqlansin degan talab).
    if (params.mijozTel && !contact.tel) {
      await tx.contact.updateMany({
        where: { id: contact.id, businessId: params.businessId },
        data: { tel: params.mijozTel },
      });
    }
    return { contactId: contact.id, ism: contact.ism, tel: contact.tel ?? params.mijozTel ?? null };
  }

  const ism = params.mijozNomi?.trim();
  if (!ism) throw new BadRequestError("Mijoz ismi kiritilishi shart");
  const tel = params.mijozTel ?? null;

  if (!params.mijozSaqla) return { contactId: null, ism, tel };

  // Telefon bo'yicha mavjud kartochka qidiriladi — bir mijozning ikkita
  // kartochkasi paydo bo'lmasin (raqam allaqachon normallashtirilgan).
  const mavjud = tel
    ? await tx.contact.findFirst({
        where: { businessId: params.businessId, tel, deletedAt: null },
        select: { id: true, ism: true, tel: true },
      })
    : null;
  if (mavjud) return { contactId: mavjud.id, ism: mavjud.ism, tel: mavjud.tel };

  const yangi = await tx.contact.create({
    data: {
      businessId: params.businessId,
      ism,
      tel: tel ?? undefined,
      createdBy: params.userId,
    },
    select: { id: true },
  });
  return { contactId: yangi.id, ism, tel };
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

  const beriladigan = debt.turi === "beriladigan";
  const supplierUser = beriladigan ? await taminotchiUserTx(tx, params.businessId, debt.id) : null;

  let transactionId: string | null = null;
  let accountId: string | null = params.accountId ?? null;

  if (supplierUser) {
    // PRO: qarz ICHKI ta'minotchi-user'ga tegishli bo'lsa — to'lov chiqim emas,
    // xaridor kassasidan ta'minotchining shaxsiy kassasiga TRANSFER: pul biznes
    // ichida qoldi, kirim/chiqim sun'iy oshmasligi kerak.
    const tolovchi = await tx.user.findFirst({
      where: { id: params.userId, tenantId: currentTenantId(), isActive: true },
      select: { id: true, ism: true },
    });
    if (!tolovchi) throw new ForbiddenError("Foydalanuvchi topilmadi");
    const fromAccount = await ensureUserKassaTx(tx, params.businessId, tolovchi);
    const toAccount = await ensureUserKassaTx(tx, params.businessId, supplierUser);
    await tx.accountTransfer.create({
      data: {
        businessId: params.businessId,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        summa: params.summa,
        valyuta: "UZS",
        sana: dateOnlyStringToUTCDate(sana),
        izoh: `Qarz to'lash: ${debt.mijozNomi}`,
        userId: params.userId,
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
    const categoryId = await ensureCategoryTx(
      tx,
      params.businessId,
      beriladigan ? QARZ_TOLASH_KATEGORIYA : QARZ_TOLOVI_KATEGORIYA,
      beriladigan ? "chiqim" : "kirim"
    );
    // To'lov usuli tranzaksiyaning to'lov turiga o'giriladi: bank ham,
    // Click ham naqdsiz pul — kassa qoldig'ida ikkalasi "click" tarafida.
    const txTolovTuri = params.tolovTuri === "naqd" ? "naqd" : params.tolovTuri ? "click" : null;
    accountId = await kassaniAniqlaTx(tx, params.businessId, params.accountId, txTolovTuri);
    const txn = await createTransactionTx(tx, params.userId, params.businessId, {
      turi: beriladigan ? "chiqim" : "kirim",
      categoryId,
      accountId,
      tolovTuri: txTolovTuri,
      summa: params.summa,
      // ENG MUHIM QATOR: kirim TO'LOV sanasi bilan yoziladi.
      sana,
      izoh: params.izoh?.trim() || `${beriladigan ? "Qarz to'lash" : "Qarz to'lovi"}: ${debt.mijozNomi}`,
    });
    transactionId = txn.id;
  }

  const payment = await tx.debtPayment.create({
    data: {
      debtId: debt.id,
      businessId: params.businessId,
      summa: params.summa,
      sana: dateOnlyStringToUTCDate(sana),
      tolovTuri: params.tolovTuri ?? undefined,
      accountId: accountId ?? undefined,
      izoh: params.izoh?.trim() || undefined,
      userId: params.userId,
      transactionId,
      idempotencyKey: params.idempotencyKey ?? undefined,
    },
    select: { id: true },
  });

  // Optimistik qulf: `tolangan` biz o'qigan qiymatda qolgan bo'lsagina yoziladi.
  // Ikki xodim bir vaqtda to'lov kiritsa — ikkinchisi jimgina yo'qolmaydi.
  const yangiTolangan = debt.tolangan + params.summa;
  const status = qarzHolatHisobla(debt.jamiSumma, yangiTolangan);
  const upd = await tx.debt.updateMany({
    where: {
      id: debt.id,
      businessId: params.businessId,
      tolangan: debt.tolangan,
      isYopilgan: false,
    },
    data: {
      tolangan: yangiTolangan,
      status,
      isYopilgan: yopiqmi(status),
      updatedBy: params.userId,
    },
  });
  if (upd.count === 0) {
    throw new BadRequestError("Qarz holati o'zgardi — sahifani yangilab qayta urinib ko'ring");
  }

  return holatNatijasi(
    { ...debt, tolangan: yangiTolangan, status, isYopilgan: yopiqmi(status) },
    payment.id,
    transactionId,
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
  tolovTuri: string | null
): Promise<string | null> {
  if (accountId) {
    const acc = await tx.account.findFirst({
      where: { id: accountId, businessId, isActive: true },
      select: { id: true },
    });
    if (!acc) throw new ForbiddenError("Kassa topilmadi yoki nofaol");
    return acc.id;
  }
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
