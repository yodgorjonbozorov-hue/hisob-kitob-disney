import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { QOLDIQ_HOLATLARI, type UserTransferInput } from "@/lib/validation/account";

/**
 * SHAXSIY KASSALAR VA FOYDALANUVCHIDAN FOYDALANUVCHIGA PUL O'TKAZISH (PRO).
 *
 * Har foydalanuvchi o'z hamyoniga (Account.userId) ega bo'la oladi. Transfer —
 * mavjud AccountTransfer ledger'ida yoziladi (SOURCE → DESTINATION), shuning
 * uchun kassa qoldig'i hisobi (lib/queries/accounts.ts) o'zgarishsiz ishlaydi.
 * Balans HECH QACHON to'g'ridan-to'g'ri yozilmaydi — faqat ledger'dan hisoblanadi.
 */

/**
 * Foydalanuvchining shaxsiy kassasini topadi, yo'q bo'lsa ochadi (tranzaksiya
 * ichida). Nomi to'qnashsa raqam qo'shiladi — Account [businessId, nomi] unique.
 */
export async function ensureUserKassaTx(
  tx: BusinessTx,
  businessId: string,
  user: { id: string; ism: string }
): Promise<{ id: string; nomi: string }> {
  const mavjud = await tx.account.findFirst({
    where: { businessId, userId: user.id, isActive: true },
    select: { id: true, nomi: true },
    orderBy: { createdAt: "asc" },
  });
  if (mavjud) return mavjud;

  let nomi = `${user.ism} (shaxsiy)`;
  for (let i = 2; i <= 20; i++) {
    const band = await tx.account.findFirst({
      where: { businessId, nomi },
      select: { id: true },
    });
    if (!band) break;
    nomi = `${user.ism} (shaxsiy ${i})`;
  }

  return tx.account.create({
    data: { businessId, nomi, turi: "naqd", userId: user.id, tartib: 100 },
    select: { id: true, nomi: true },
  });
}

/** Kassaning joriy qoldig'i — tranzaksiya ichida, ledger'dan. */
export async function kassaQoldiqTx(
  tx: BusinessTx,
  businessId: string,
  accountId: string
): Promise<number> {
  const [kirim, chiqim, kirgan, chiqqan] = await Promise.all([
    tx.transaction.aggregate({
      where: { businessId, accountId, turi: "kirim", deletedAt: null },
      _sum: { summa: true },
    }),
    tx.transaction.aggregate({
      where: { businessId, accountId, turi: "chiqim", deletedAt: null },
      _sum: { summa: true },
    }),
    // "kutilmoqda"/"rad" qoldiqqa kirmaydi — pul hali (yoki umuman) ko'chmagan.
    tx.accountTransfer.aggregate({
      where: { businessId, toAccountId: accountId, holat: { in: [...QOLDIQ_HOLATLARI] } },
      _sum: { summa: true },
    }),
    tx.accountTransfer.aggregate({
      where: { businessId, fromAccountId: accountId, holat: { in: [...QOLDIQ_HOLATLARI] } },
      _sum: { summa: true },
    }),
  ]);
  return (
    (kirim._sum.summa ?? 0) -
    (chiqim._sum.summa ?? 0) +
    (kirgan._sum.summa ?? 0) -
    (chiqqan._sum.summa ?? 0)
  );
}

/**
 * Kassadan chiqishi KUTILAYOTGAN summa — qabul qiluvchi hali tasdiqlamagan
 * o'tkazmalar. Ular qoldiqda turaveradi (pul limbo'da qolmasin), shuning
 * uchun yangi o'tkazmada ular MAVJUD qoldiqdan ayriladi — aks holda bir pulni
 * ikki marta jo'natish mumkin bo'lardi.
 */
export async function kutilayotganChiqimTx(
  tx: BusinessTx,
  businessId: string,
  accountId: string
): Promise<number> {
  const kutayotgan = await tx.accountTransfer.aggregate({
    where: { businessId, fromAccountId: accountId, holat: "kutilmoqda" },
    _sum: { summa: true },
  });
  return kutayotgan._sum.summa ?? 0;
}

/** Yangi o'tkazma uchun HAQIQATDA sarflanadigan pul: qoldiq − kutilayotgan chiqim. */
export async function mavjudQoldiqTx(
  tx: BusinessTx,
  businessId: string,
  accountId: string
): Promise<{ qoldiq: number; kutilayotgan: number; mavjud: number }> {
  const [qoldiq, kutilayotgan] = await Promise.all([
    kassaQoldiqTx(tx, businessId, accountId),
    kutilayotganChiqimTx(tx, businessId, accountId),
  ]);
  return { qoldiq, kutilayotgan, mavjud: qoldiq - kutilayotgan };
}

interface UserTransferParams {
  businessId: string;
  /** Amalni bajarayotgan foydalanuvchi (yuboruvchi ham shu). */
  actorId: string;
  actorRol: string;
  data: UserTransferInput;
  /** Bog'liq hujjat (masalan xarid buyurtmasi). */
  relatedType?: string;
  relatedId?: string;
}

/**
 * FOYDALANUVCHIDAN FOYDALANUVCHIGA O'TKAZMA.
 *
 * Validatsiya:
 *  - yuboruvchi ≠ qabul qiluvchi;
 *  - ikkala user ham shu tenantda va faol;
 *  - balans yetarli bo'lmasa faqat boshqaruvchi (OWNER/ADMIN) minusga o'tkaza
 *    oladi (biznes qoidasi) — xodim uchun xato qaytadi.
 */
export async function createUserTransfer(params: UserTransferParams) {
  const { businessId, actorId, data } = params;
  const tenantId = currentTenantId();

  if (data.toUserId === actorId) {
    throw new BadRequestError("O'zingizga pul o'tkazib bo'lmaydi");
  }

  const transfer = await runBusinessTx(businessId, async (tx) => {
    // Har so'rovda tenant/business sharti QO'LDA — runBusinessTx kelishuvi.
    const userlar = await tx.user.findMany({
      where: { id: { in: [actorId, data.toUserId] }, tenantId, isActive: true },
      select: { id: true, ism: true },
    });
    const yuboruvchi = userlar.find((u) => u.id === actorId);
    const oluvchi = userlar.find((u) => u.id === data.toUserId);
    if (!yuboruvchi || !oluvchi) {
      throw new ForbiddenError("Foydalanuvchi topilmadi yoki faol emas");
    }

    // Yuboruvchi kassa: tanlangan bo'lsa tekshiriladi, aks holda shaxsiy kassa.
    let fromAccount: { id: string; nomi: string };
    if (data.fromAccountId) {
      const acc = await tx.account.findFirst({
        where: { id: data.fromAccountId, businessId, isActive: true },
        select: { id: true, nomi: true, userId: true },
      });
      if (!acc) throw new ForbiddenError("Kassa topilmadi yoki nofaol");
      // Birovning shaxsiy kassasidan faqat boshqaruvchi pul chiqara oladi.
      if (acc.userId && acc.userId !== actorId && !isManager(params.actorRol)) {
        throw new ForbiddenError("Bu kassa boshqa foydalanuvchiga tegishli");
      }
      fromAccount = acc;
    } else {
      fromAccount = await ensureUserKassaTx(tx, businessId, yuboruvchi);
    }

    const toAccount = await ensureUserKassaTx(tx, businessId, oluvchi);
    if (fromAccount.id === toAccount.id) {
      throw new BadRequestError("Bitta kassaning o'ziga o'tkazib bo'lmaydi");
    }

    // Kutilayotgan (hali tasdiqlanmagan) chiqim ham hisobga olinadi — aks
    // holda bir pulni ikki marta jo'natish mumkin bo'lardi.
    const { mavjud } = await mavjudQoldiqTx(tx, businessId, fromAccount.id);
    if (mavjud < data.summa && !isManager(params.actorRol)) {
      throw new BadRequestError(
        `Kassada yetarli mablag' yo'q (mavjud: ${mavjud.toLocaleString("uz")} so'm)`
      );
    }

    return tx.accountTransfer.create({
      data: {
        businessId,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        summa: data.summa,
        valyuta: "UZS",
        sana: dateOnlyStringToUTCDate(data.sana),
        izoh: data.izoh?.trim() || undefined,
        userId: actorId,
        fromUserId: yuboruvchi.id,
        fromUserIsm: yuboruvchi.ism,
        toUserId: oluvchi.id,
        toUserIsm: oluvchi.ism,
        holat: "bajarildi",
        relatedType: params.relatedType,
        relatedId: params.relatedId,
      },
    });
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "accountTransfer",
    entityId: transfer.id,
    after: {
      turi: "user-to-user",
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      summa: transfer.summa,
      relatedType: params.relatedType ?? null,
    },
  });
  return transfer;
}

/**
 * O'TKAZMANI BEKOR QILISH — STORNO.
 *
 * Ledger append-only: asl yozuv o'chirilmaydi, qarama-qarshi yo'nalishda
 * teskari transfer yoziladi va asl yozuv "bekor" deb belgilanadi. Shu tarzda
 * balanslar avtomatik tiklanadi va tarix to'liq saqlanadi.
 */
export async function cancelUserTransfer(params: {
  businessId: string;
  transferId: string;
  actorId: string;
  actorRol: string;
}) {
  if (!isManager(params.actorRol)) {
    throw new ForbiddenError("O'tkazmani faqat boshqaruvchi bekor qila oladi");
  }

  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const asl = await tx.accountTransfer.findFirst({
      where: { id: params.transferId, businessId: params.businessId },
    });
    if (!asl) throw new ForbiddenError("O'tkazma topilmadi");
    if (asl.holat === "bekor") throw new BadRequestError("Bu o'tkazma allaqachon bekor qilingan");

    const storno = await tx.accountTransfer.create({
      data: {
        businessId: params.businessId,
        fromAccountId: asl.toAccountId,
        toAccountId: asl.fromAccountId,
        summa: asl.summa,
        valyuta: asl.valyuta,
        sana: new Date(),
        izoh: `Storno: ${asl.izoh ?? asl.id}`,
        userId: params.actorId,
        fromUserId: asl.toUserId,
        fromUserIsm: asl.toUserIsm,
        toUserId: asl.fromUserId,
        toUserIsm: asl.fromUserIsm,
        holat: "bajarildi",
        relatedType: "storno",
        relatedId: asl.id,
      },
    });

    await tx.accountTransfer.updateMany({
      where: { id: asl.id, businessId: params.businessId },
      data: { holat: "bekor" },
    });

    return { asl, storno };
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "accountTransfer",
    entityId: params.transferId,
    before: { holat: "bajarildi" },
    after: { holat: "bekor", stornoId: natija.storno.id, summa: natija.asl.summa },
  });
  return natija;
}
