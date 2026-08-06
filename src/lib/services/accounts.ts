import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import type { CreateAccountInput, TransferInput, UpdateAccountInput } from "@/lib/validation/account";

/** Har yangi biznesda avtomatik ochiladigan kassa. */
export const DEFAULT_KASSA_NOMI = "Naqd kassa";

export async function createAccount(businessId: string, data: CreateAccountInput) {
  const mavjud = await prisma.account.findFirst({
    where: { businessId, nomi: data.nomi },
    select: { id: true },
  });
  if (mavjud) throw new BadRequestError("Bu nomdagi kassa allaqachon bor");

  return prisma.account.create({
    data: {
      businessId,
      nomi: data.nomi,
      turi: data.turi,
      tartib: data.tartib ?? 0,
    },
  });
}

export async function updateAccount(businessId: string, id: string, data: UpdateAccountInput) {
  const mavjud = await prisma.account.findFirst({ where: { id, businessId } });
  if (!mavjud) throw new ForbiddenError("Kassa topilmadi");

  if (data.nomi && data.nomi !== mavjud.nomi) {
    const band = await prisma.account.findFirst({
      where: { businessId, nomi: data.nomi },
      select: { id: true },
    });
    if (band) throw new BadRequestError("Bu nomdagi kassa allaqachon bor");
  }

  // Oxirgi faol kassani o'chirib bo'lmaydi — aks holda yangi yozuv qayerga
  // tushishini ko'rsatib bo'lmay qoladi.
  if (data.isActive === false && mavjud.isActive) {
    const faollar = await prisma.account.count({ where: { businessId, isActive: true } });
    if (faollar <= 1) throw new BadRequestError("Oxirgi faol kassani o'chirib bo'lmaydi");
  }

  return prisma.account.update({ where: { id }, data });
}

/**
 * Kassani butunlay o'chirish — faqat unga BIRORTA yozuv bog'lanmagan bo'lsa.
 * Aks holda tarix buziladi; foydalanuvchi uni "nofaol" qilishi kerak.
 */
export async function deleteAccount(businessId: string, id: string) {
  const mavjud = await prisma.account.findFirst({ where: { id, businessId } });
  if (!mavjud) throw new ForbiddenError("Kassa topilmadi");

  const [txSoni, transferSoni] = await Promise.all([
    prisma.transaction.count({ where: { businessId, accountId: id } }),
    prisma.accountTransfer.count({
      where: { businessId, OR: [{ fromAccountId: id }, { toAccountId: id }] },
    }),
  ]);
  if (txSoni + transferSoni > 0) {
    throw new BadRequestError(
      `Bu kassada ${txSoni + transferSoni} ta yozuv bor — o'chirib bo'lmaydi. ` +
        `Uni "nofaol" qiling: tarix saqlanadi, yangi yozuvlarda ko'rinmaydi.`
    );
  }

  await prisma.account.delete({ where: { id } });
  return { ok: true };
}

/**
 * KASSALAR ARO PUL KO'CHIRISH.
 *
 * ATAYLAB Transaction yozmaydi: pul biznesga kirmadi ham, chiqmadi ham —
 * u shunchaki joyini o'zgartirdi. Tranzaksiya yozilsa kunlik kirim va chiqim
 * sun'iy oshib ketardi va sof foyda to'g'ri bo'lsa-da, aylanma yolg'on ko'rinardi.
 *
 * Ikkala kassa ham SHU biznesga tegishli ekani tranzaksiya ichida tekshiriladi.
 */
export async function createTransfer(
  businessId: string,
  userId: string,
  data: TransferInput
) {
  const transfer = await runBusinessTx(businessId, async (tx) => {
    const kassalar = await tx.account.findMany({
      where: { id: { in: [data.fromAccountId, data.toAccountId] }, businessId },
      select: { id: true, nomi: true, isActive: true },
    });
    if (kassalar.length !== 2) {
      throw new ForbiddenError("Kassa topilmadi yoki boshqa biznesga tegishli");
    }
    if (kassalar.some((k) => !k.isActive)) {
      throw new BadRequestError("Nofaol kassa bilan pul ko'chirib bo'lmaydi");
    }

    return tx.accountTransfer.create({
      data: {
        businessId,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        summa: data.summa,
        sana: dateOnlyStringToUTCDate(data.sana),
        izoh: data.izoh?.trim() || undefined,
        userId,
      },
    });
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "accountTransfer",
    entityId: transfer.id,
    after: {
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      summa: data.summa,
    },
  });
  return transfer;
}

/**
 * Yozuv uchun kassani aniqlaydi.
 *
 * Foydalanuvchi tanlagan bo'lsa — u shu biznesniki ekani tekshiriladi.
 * Tanlanmagan bo'lsa — birinchi faol kassa (bitta kassali bizneslarda UI'da
 * bu qadam umuman ko'rsatilmaydi).
 */
export async function resolveAccountId(
  businessId: string,
  accountId?: string | null
): Promise<string | null> {
  if (accountId) {
    const acc = await prisma.account.findFirst({
      where: { id: accountId, businessId, isActive: true },
      select: { id: true },
    });
    if (!acc) throw new ForbiddenError("Kassa topilmadi yoki nofaol");
    return acc.id;
  }
  const birinchi = await prisma.account.findFirst({
    where: { businessId, isActive: true },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  return birinchi?.id ?? null;
}
