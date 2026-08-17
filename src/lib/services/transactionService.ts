import { prisma } from "@/lib/prisma";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { ForbiddenError } from "@/lib/auth/guard";
import type { BusinessTx } from "@/lib/db/businessTx";
import { resolveAccountId } from "@/lib/services/accounts";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { assertYangiYozuvDavri, assertYangiYozuvDavriTx } from "@/lib/services/davrQulfi";

export interface CreateTransactionData {
  turi: "kirim" | "chiqim";
  categoryId: string;
  summa: number;
  sana: string; // "YYYY-MM-DD"
  izoh?: string | null;
  filial?: string | null;
  /** Qaysi kassa/hisob-raqamga tushdi. Berilmasa to'lov turiga mos faol kassa olinadi. */
  accountId?: string | null;
  /** "naqd" | "click" | "qarz". Berilmasa kassa turidan chiqariladi (eski xulq). */
  tolovTuri?: string | null;
}

/**
 * Yagona joy — API route va Telegram bot ikkalasi ham shu funksiyani chaqiradi.
 * Kategoriya aynan shu biznesga tegishli ekani tekshiriladi (cross-business himoya).
 */
export async function createTransaction(userId: string, businessId: string, data: CreateTransactionData) {
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
    select: { businessId: true, turi: true },
  });
  if (!category || category.businessId !== businessId) {
    throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
  }

  // Yopilgan davr qulfi: tasdiqlangan kunga yangi yozuv kiritilmaydi
  // (audit: Critical #4). Barcha modullar yozuvni shu yerdan yaratadi,
  // shuning uchun qulf ham shu yerda — bitta joyda.
  await assertYangiYozuvDavri(businessId, dateOnlyStringToUTCDate(data.sana));

  // Kassa: tanlangani tekshiriladi, tanlanmagani — to'lov turiga mos faol
  // kassa. QARZ — pul kassaga tushmagan, hech qaysi kassaga bog'lanmaydi
  // (kassa qoldig'iga kirmaydi).
  const accountId =
    data.tolovTuri === "qarz"
      ? null
      : await resolveAccountId(businessId, data.accountId, data.tolovTuri);

  const created = await prisma.transaction.create({
    data: {
      turi: data.turi,
      categoryId: data.categoryId,
      businessId,
      accountId,
      tolovTuri: data.tolovTuri ?? undefined,
      summa: data.summa,
      sana: dateOnlyStringToUTCDate(data.sana),
      izoh: data.izoh ?? undefined,
      filial: data.filial ?? undefined,
      userId,
    },
    include: {
      category: true,
      user: { select: { id: true, ism: true } },
      account: { select: { id: true, nomi: true, turi: true } },
    },
  });

  // BUGUNGI sanali kirim kunlik hisobotga o'zi tushadi (boshqa sana — tushmaydi).
  // Sinxron xatosi asosiy yozuvni buzmaydi (kunlikSinxron ichida ushlanadi).
  await kunlikSinxron(created, created.user.ism);

  return created;
}

/**
 * `createTransaction`ning tranzaksiya ichida ishlaydigan varianti.
 * Xom `tx` delegatlari ishlatilgani uchun `businessId` sharti QO'LDA yoziladi
 * (batafsil: lib/db/businessTx.ts).
 */
export async function createTransactionTx(
  tx: BusinessTx,
  userId: string,
  businessId: string,
  data: CreateTransactionData
) {
  const category = await tx.category.findFirst({
    where: { id: data.categoryId, businessId },
    select: { id: true },
  });
  if (!category) {
    throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
  }

  // Yopilgan davr qulfi (audit: Critical #4) — tranzaksiya ichidagi variant.
  await assertYangiYozuvDavriTx(tx, businessId, dateOnlyStringToUTCDate(data.sana));

  // Tranzaksiya ichida: kassa xom `tx` bilan qidiriladi (businessId qo'lda).
  // QARZ — kassaga bog'lanmaydi (createTransaction bilan bir xil qoida).
  let accountId = data.tolovTuri === "qarz" ? null : data.accountId ?? null;
  if (accountId) {
    const acc = await tx.account.findFirst({
      where: { id: accountId, businessId, isActive: true },
      select: { id: true },
    });
    if (!acc) throw new ForbiddenError("Kassa topilmadi yoki nofaol");
  } else if (data.tolovTuri !== "qarz") {
    const birinchi = await tx.account.findFirst({
      where: { businessId, isActive: true },
      orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    accountId = birinchi?.id ?? null;
  }

  return tx.transaction.create({
    data: {
      turi: data.turi,
      categoryId: data.categoryId,
      businessId,
      accountId,
      tolovTuri: data.tolovTuri ?? undefined,
      summa: data.summa,
      sana: dateOnlyStringToUTCDate(data.sana),
      izoh: data.izoh ?? undefined,
      filial: data.filial ?? undefined,
      userId,
    },
  });
}
