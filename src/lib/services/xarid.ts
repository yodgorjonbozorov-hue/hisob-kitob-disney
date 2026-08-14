import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import { createTransactionTx } from "@/lib/services/transactionService";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { ensureUserKassaTx } from "@/lib/services/userKassa";
import { dateOnlyStringToUTCDate, todayDateOnlyString } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import type {
  CreateOrderInput,
  CreateSupplierInput,
  UpdateOrderInput,
  UpdateSupplierInput,
} from "@/lib/validation/xarid";

/** Qabul qilingan xarid uchun avtomatik chiqim kategoriyasi. */
const XARID_KATEGORIYA = "Tovar xaridi";

// ---------------------------------------------------------------------------
// Ta'minotchilar
// ---------------------------------------------------------------------------

/** Ta'minotchi bog'lanadigan user shu tenantda va faol ekanini tekshiradi. */
async function tekshirSupplierUser(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  // Tenant-scoped client: boshqa tenant useri bu yerda ko'rinmaydi (null qaytadi).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });
  if (!user || !user.isActive) {
    throw new BadRequestError("Bog'lanadigan foydalanuvchi topilmadi yoki faol emas");
  }
  return user.id;
}

export async function createSupplier(businessId: string, data: CreateSupplierInput) {
  const mavjud = await prisma.supplier.findFirst({
    where: { businessId, nomi: data.nomi, deletedAt: null },
    select: { id: true },
  });
  if (mavjud) throw new BadRequestError("Bu nomdagi ta'minotchi allaqachon bor");

  const userId = await tekshirSupplierUser(data.userId);

  return prisma.supplier.create({
    data: {
      businessId,
      nomi: data.nomi,
      userId: userId ?? undefined,
      tel: data.tel?.trim() || undefined,
      manzil: data.manzil?.trim() || undefined,
      izoh: data.izoh?.trim() || undefined,
    },
  });
}

export async function updateSupplier(businessId: string, id: string, data: UpdateSupplierInput) {
  const mavjud = await prisma.supplier.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Ta'minotchi topilmadi");
  const { userId, ...qolgan } = data;
  const tekshirilgan =
    userId === undefined ? undefined : userId === null ? null : await tekshirSupplierUser(userId);
  return prisma.supplier.update({
    where: { id },
    data: { ...qolgan, ...(tekshirilgan === undefined ? {} : { userId: tekshirilgan }) },
  });
}

/**
 * Ta'minotchini o'chirish — yumshoq (buyurtmalar tarixi saqlanadi).
 * Butunlay o'chirish tarixni yo'q qilardi: "bu tovarni kimdan olgan edik?"
 * degan savolga javob qolmasdi.
 */
export async function deleteSupplier(businessId: string, id: string) {
  const mavjud = await prisma.supplier.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Ta'minotchi topilmadi");

  const ochiq = await prisma.purchaseOrder.count({
    where: { businessId, supplierId: id, holat: { in: ["qoralama", "tasdiqlangan"] } },
  });
  if (ochiq > 0) {
    throw new BadRequestError(
      `Bu ta'minotchida ${ochiq} ta yopilmagan buyurtma bor — avval ularni yakunlang yoki bekor qiling`
    );
  }

  await prisma.supplier.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Xarid buyurtmasi
// ---------------------------------------------------------------------------

/** Satrlarni tekshiradi va jami summani hisoblaydi (tranzaksiya ichida). */
async function satrlarniTayyorla(
  tx: BusinessTx,
  businessId: string,
  satrlar: CreateOrderInput["satrlar"]
) {
  const productIds = [...new Set(satrlar.map((s) => s.productId))];
  const mahsulotlar = await tx.product.findMany({
    where: { id: { in: productIds }, businessId },
    select: { id: true },
  });
  if (mahsulotlar.length !== productIds.length) {
    throw new ForbiddenError("Mahsulot topilmadi yoki boshqa biznesga tegishli");
  }

  const tayyor = satrlar.map((s) => ({
    productId: s.productId,
    miqdor: s.miqdor,
    birlikNarx: s.birlikNarx,
    jamiSumma: s.miqdor * s.birlikNarx,
  }));
  return { tayyor, jamiSumma: tayyor.reduce((a, s) => a + s.jamiSumma, 0) };
}

export async function createOrder(businessId: string, userId: string, data: CreateOrderInput) {
  const order = await runBusinessTx(businessId, async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: data.supplierId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) throw new ForbiddenError("Ta'minotchi topilmadi");

    const { tayyor, jamiSumma } = await satrlarniTayyorla(tx, businessId, data.satrlar);

    const created = await tx.purchaseOrder.create({
      data: {
        businessId,
        supplierId: data.supplierId,
        holat: "qoralama",
        sana: dateOnlyStringToUTCDate(data.sana),
        tolovTuri: data.tolovTuri,
        jamiSumma,
        izoh: data.izoh?.trim() || undefined,
        userId,
      },
    });

    for (const s of tayyor) {
      await tx.purchaseOrderItem.create({ data: { businessId, orderId: created.id, ...s } });
    }
    return created;
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "purchaseOrder",
    entityId: order.id,
    after: { supplierId: data.supplierId, jamiSumma: order.jamiSumma, satrlar: data.satrlar.length },
  });
  return order;
}

/** Buyurtmani tahrirlash — FAQAT qoralama holatida (tasdiqlangani o'zgarmaydi). */
export async function updateOrder(
  businessId: string,
  orderId: string,
  data: UpdateOrderInput
) {
  return runBusinessTx(businessId, async (tx) => {
    const order = await tx.purchaseOrder.findFirst({ where: { id: orderId, businessId } });
    if (!order) throw new ForbiddenError("Buyurtma topilmadi");
    if (order.holat !== "qoralama") {
      throw new BadRequestError("Faqat qoralama buyurtmani tahrirlash mumkin");
    }

    let jamiSumma = order.jamiSumma;
    if (data.satrlar) {
      const { tayyor, jamiSumma: yangi } = await satrlarniTayyorla(tx, businessId, data.satrlar);
      await tx.purchaseOrderItem.deleteMany({ where: { orderId, businessId } });
      for (const s of tayyor) {
        await tx.purchaseOrderItem.create({ data: { businessId, orderId, ...s } });
      }
      jamiSumma = yangi;
    }

    return tx.purchaseOrder.update({
      where: { id: orderId },
      data: {
        ...(data.supplierId ? { supplierId: data.supplierId } : {}),
        ...(data.sana ? { sana: dateOnlyStringToUTCDate(data.sana) } : {}),
        ...(data.tolovTuri ? { tolovTuri: data.tolovTuri } : {}),
        ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
        jamiSumma,
      },
    });
  });
}

/**
 * BUYURTMANI QABUL QILISH — modulning yuragi.
 *
 * Bitta atomik amalda:
 *   1. har satr uchun `StockEntry` (ombor qoldig'i oshadi, tannarx snapshot);
 *   2. `Product.kelganNarx` yangi tannarxga yangilanadi;
 *   3. pul harakati:
 *      - TASHQI ta'minotchi: to'langan qism chiqim tranzaksiya;
 *      - ICHKI ta'minotchi (supplier.userId, PRO): to'langan qism xaridor
 *        kassasidan ta'minotchi-userning SHAXSIY kassasiga transfer — pul
 *        biznes ichida qolgani uchun bu chiqim EMAS (AccountTransfer falsafasi);
 *      - to'lanmagan qoldiq — "beriladigan" qarz (keyin DebtPayment bilan yopiladi).
 *   `tolanganSumma` berilmasa eski xatti-harakat: naqd → to'liq, qarz → 0.
 *
 * Qoralama va tasdiqlangan buyurtma hech narsaga ta'sir qilmaydi — reja
 * bilan haqiqat aralashmasligi kerak.
 */
export async function qabulQilish(params: {
  businessId: string;
  orderId: string;
  userId: string;
  qabulSana?: string | null;
  /** QISMAN TO'LOV (PRO): qabul paytida to'lanadigan qism (0..jami). */
  tolanganSumma?: number | null;
  /** To'lov qaysi kassadan (berilmasa — shaxsiy/default kassa). */
  accountId?: string | null;
}) {
  const sana = params.qabulSana ?? todayDateOnlyString();
  const tenantId = currentTenantId();

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: { id: params.orderId, businessId: params.businessId },
    });
    if (!order) throw new ForbiddenError("Buyurtma topilmadi");
    if (order.holat === "qabul_qilingan") {
      throw new BadRequestError("Bu buyurtma allaqachon qabul qilingan");
    }
    if (order.holat === "bekor") {
      throw new BadRequestError("Bekor qilingan buyurtmani qabul qilib bo'lmaydi");
    }

    const satrlar = await tx.purchaseOrderItem.findMany({
      where: { orderId: order.id, businessId: params.businessId },
    });
    if (satrlar.length === 0) throw new BadRequestError("Buyurtmada satr yo'q");

    const supplier = await tx.supplier.findFirst({
      where: { id: order.supplierId, businessId: params.businessId },
      select: { nomi: true, userId: true },
    });

    let jamiSumma = 0;
    for (const s of satrlar) {
      jamiSumma += s.jamiSumma;

      // Ombor kirimi + tannarx snapshot.
      await tx.stockEntry.create({
        data: {
          businessId: params.businessId,
          productId: s.productId,
          miqdor: s.miqdor,
          birlikNarx: s.birlikNarx,
          userId: params.userId,
          izoh: `Xarid: ${supplier?.nomi ?? "ta'minotchi"}`,
        },
      });
      await tx.product.updateMany({
        where: { id: s.productId, businessId: params.businessId },
        data: { miqdor: { increment: s.miqdor }, kelganNarx: s.birlikNarx },
      });
    }

    // To'langan qism: berilmasa eski xatti-harakat (naqd → to'liq, qarz → 0).
    const tolangan =
      params.tolanganSumma ?? (order.tolovTuri === "naqd" ? jamiSumma : 0);
    if (tolangan < 0 || tolangan > jamiSumma) {
      throw new BadRequestError("To'langan summa 0 va jami summa oralig'ida bo'lishi kerak");
    }

    let transactionId: string | null = null;
    let transferId: string | null = null;
    let debtId: string | null = null;

    // ICHKI ta'minotchi (tizim useri) — to'lov shaxsiy kassaga transfer.
    const supplierUser = supplier?.userId
      ? await tx.user.findFirst({
          where: { id: supplier.userId, tenantId, isActive: true },
          select: { id: true, ism: true },
        })
      : null;

    if (tolangan > 0) {
      if (supplierUser) {
        const xaridor = await tx.user.findFirst({
          where: { id: params.userId, tenantId, isActive: true },
          select: { id: true, ism: true },
        });
        if (!xaridor) throw new ForbiddenError("Foydalanuvchi topilmadi");
        if (xaridor.id === supplierUser.id) {
          throw new BadRequestError("Ta'minotchi va xaridor bitta foydalanuvchi bo'lishi mumkin emas");
        }

        let fromAccountId: string;
        if (params.accountId) {
          const acc = await tx.account.findFirst({
            where: { id: params.accountId, businessId: params.businessId, isActive: true },
            select: { id: true },
          });
          if (!acc) throw new ForbiddenError("Kassa topilmadi yoki nofaol");
          fromAccountId = acc.id;
        } else {
          fromAccountId = (await ensureUserKassaTx(tx, params.businessId, xaridor)).id;
        }
        const toAccount = await ensureUserKassaTx(tx, params.businessId, supplierUser);

        const transfer = await tx.accountTransfer.create({
          data: {
            businessId: params.businessId,
            fromAccountId,
            toAccountId: toAccount.id,
            summa: tolangan,
            valyuta: "UZS",
            sana: dateOnlyStringToUTCDate(sana),
            izoh: `Xarid to'lovi: ${supplier?.nomi ?? ""}`.trim(),
            userId: params.userId,
            fromUserId: xaridor.id,
            fromUserIsm: xaridor.ism,
            toUserId: supplierUser.id,
            toUserIsm: supplierUser.ism,
            holat: "bajarildi",
            relatedType: "purchaseOrder",
            relatedId: order.id,
          },
        });
        transferId = transfer.id;
      } else {
        const categoryId = await ensureCategoryTx(tx, params.businessId, XARID_KATEGORIYA, "chiqim");
        const txn = await createTransactionTx(tx, params.userId, params.businessId, {
          turi: "chiqim",
          categoryId,
          summa: tolangan,
          sana,
          accountId: params.accountId ?? undefined,
          izoh: `Xarid: ${supplier?.nomi ?? ""}`.trim(),
        });
        transactionId = txn.id;
      }
    }

    // To'lanmagan qoldiq — ta'minotchiga qarz.
    const qoldiq = jamiSumma - tolangan;
    if (qoldiq > 0) {
      const debt = await tx.debt.create({
        data: {
          businessId: params.businessId,
          turi: "beriladigan",
          mijozNomi: supplier?.nomi ?? "Ta'minotchi",
          jamiSumma: qoldiq,
          izoh: `Xarid buyurtmasi`,
          userId: params.userId,
        },
      });
      debtId = debt.id;
    }

    return tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        holat: "qabul_qilingan",
        qabulSana: dateOnlyStringToUTCDate(sana),
        jamiSumma,
        tolanganSumma: tolangan,
        transactionId,
        transferId,
        debtId,
      },
    });
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "purchaseOrder",
    entityId: params.orderId,
    after: {
      holat: "qabul_qilingan",
      jamiSumma: natija.jamiSumma,
      tolanganSumma: natija.tolanganSumma,
      sana,
    },
  });
  return natija;
}

/** Tasdiqlash yoki bekor qilish (qabul qilish alohida funksiyada). */
export async function orderHolatiniOzgartir(params: {
  businessId: string;
  orderId: string;
  holat: "tasdiqlangan" | "bekor";
}) {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: params.orderId, businessId: params.businessId },
  });
  if (!order) throw new ForbiddenError("Buyurtma topilmadi");
  if (order.holat === "qabul_qilingan") {
    throw new BadRequestError(
      "Qabul qilingan buyurtma holatini o'zgartirib bo'lmaydi — ombor va pul yozuvlari yozilgan"
    );
  }
  if (params.holat === "tasdiqlangan" && order.holat !== "qoralama") {
    throw new BadRequestError("Faqat qoralama buyurtmani tasdiqlash mumkin");
  }

  return prisma.purchaseOrder.update({
    where: { id: params.orderId },
    data: { holat: params.holat },
  });
}
