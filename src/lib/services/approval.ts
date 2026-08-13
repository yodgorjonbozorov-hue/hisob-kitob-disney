import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { runBusinessTx } from "@/lib/db/businessTx";
import {
  createTransaction,
  createTransactionTx,
  type CreateTransactionData,
} from "@/lib/services/transactionService";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { normalizeRol, type Rol } from "@/lib/auth/roles";
import { formatSom } from "@/lib/format";
import type { CreateRuleInput, UpdateRuleInput } from "@/lib/validation/approval";

/**
 * Rol darajasi — kim kimning so'rovini tasdiqlay oladi.
 * So'rovchining darajasi tasdiqlovchi darajasidan past bo'lsagina tasdiq kerak:
 * direktor o'z chiqimini o'zi tasdiqlab o'tirmaydi.
 */
const ROL_DARAJA: Record<Rol, number> = {
  SUPERADMIN: 4,
  OWNER: 3,
  ADMIN: 2,
  CASHIER: 1,
  SELLER: 1,
};

function daraja(rol: string): number {
  return ROL_DARAJA[normalizeRol(rol)] ?? 0;
}

// ---------------------------------------------------------------------------
// Qoidalar
// ---------------------------------------------------------------------------

export async function createRule(businessId: string, data: CreateRuleInput) {
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: data.categoryId, businessId },
      select: { turi: true },
    });
    if (!cat) throw new ForbiddenError("Kategoriya topilmadi");
    if (cat.turi !== "chiqim") {
      throw new BadRequestError("Tasdiqlash qoidasi faqat chiqim kategoriyasiga qo'yiladi");
    }
  }

  // Bir xil qamrovdagi ikkinchi faol qoida chalkashlik tug'diradi.
  const mavjud = await prisma.approvalRule.findFirst({
    where: { businessId, categoryId: data.categoryId ?? null, deletedAt: null },
    select: { id: true },
  });
  if (mavjud) {
    throw new BadRequestError(
      data.categoryId
        ? "Bu kategoriya uchun qoida allaqachon bor — uni tahrirlang"
        : "Umumiy qoida allaqachon bor — uni tahrirlang"
    );
  }

  return prisma.approvalRule.create({
    data: {
      businessId,
      categoryId: data.categoryId ?? null,
      chegara: data.chegara,
      tasdiqlovchiRol: data.tasdiqlovchiRol,
      izoh: data.izoh?.trim() || undefined,
    },
  });
}

export async function updateRule(businessId: string, id: string, data: UpdateRuleInput) {
  const mavjud = await prisma.approvalRule.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Qoida topilmadi");

  if (data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: data.categoryId, businessId },
      select: { turi: true },
    });
    if (!cat) throw new ForbiddenError("Kategoriya topilmadi");
    if (cat.turi !== "chiqim") {
      throw new BadRequestError("Tasdiqlash qoidasi faqat chiqim kategoriyasiga qo'yiladi");
    }
  }

  return prisma.approvalRule.update({
    where: { id },
    data: {
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.chegara !== undefined ? { chegara: data.chegara } : {}),
      ...(data.tasdiqlovchiRol ? { tasdiqlovchiRol: data.tasdiqlovchiRol } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
    },
  });
}

/**
 * Qoidani o'chirish — yumshoq. Qattiq o'chirilsa, shu qoida bo'yicha
 * yaratilgan so'rovlar "nega tasdiq so'ralgan edi?" degan savolsiz qolardi.
 */
export async function deleteRule(businessId: string, id: string) {
  const mavjud = await prisma.approvalRule.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Qoida topilmadi");
  await prisma.approvalRule.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tekshiruv: bu chiqim tasdiq talab qiladimi?
// ---------------------------------------------------------------------------

export interface MosQoida {
  id: string;
  chegara: number;
  tasdiqlovchiRol: string;
}

/**
 * Chiqimga mos keladigan eng QATTIQ qoida (chegarasi eng past). Kategoriyaga
 * atalgan qoida ham, umumiy qoida ham hisobga olinadi.
 *
 * `null` — tasdiq kerak emas: mos qoida yo'q, yoki so'rovchining darajasi
 * tasdiqlovchi darajasidan past emas.
 */
export async function mosQoidaniTop(params: {
  businessId: string;
  categoryId: string;
  summa: number;
  sorovchiRol: string;
}): Promise<MosQoida | null> {
  const qoidalar = await prisma.approvalRule.findMany({
    where: {
      businessId: params.businessId,
      isActive: true,
      deletedAt: null,
      chegara: { lt: params.summa },
      OR: [{ categoryId: params.categoryId }, { categoryId: null }],
    },
    select: { id: true, chegara: true, tasdiqlovchiRol: true },
    orderBy: { chegara: "asc" },
  });

  const sorovchi = daraja(params.sorovchiRol);
  for (const q of qoidalar) {
    if (sorovchi < daraja(q.tasdiqlovchiRol)) return q;
  }
  return null;
}

// ---------------------------------------------------------------------------
// So'rov yaratish va qaror
// ---------------------------------------------------------------------------

export async function createRequest(params: {
  businessId: string;
  userId: string;
  qoida: MosQoida;
  data: CreateTransactionData;
}) {
  const { businessId, data } = params;
  const category = await prisma.category.findFirst({
    where: { id: data.categoryId, businessId },
    select: { id: true, turi: true },
  });
  if (!category) throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");

  const request = await prisma.approvalRequest.create({
    data: {
      businessId,
      ruleId: params.qoida.id,
      categoryId: data.categoryId,
      accountId: data.accountId ?? null,
      summa: data.summa,
      sana: dateOnlyStringToUTCDate(data.sana),
      izoh: data.izoh ?? undefined,
      filial: data.filial ?? undefined,
      holat: "kutilmoqda",
      userId: params.userId,
    },
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "approvalRequest",
    entityId: request.id,
    after: { summa: request.summa, chegara: params.qoida.chegara },
  });
  return request;
}

/**
 * TASDIQLASH — shu yerda birinchi marta haqiqiy pul yozuvi paydo bo'ladi.
 *
 * Bitta atomik amalda: holat qayta tekshiriladi (ikki rahbar bir vaqtda
 * bosishi mumkin), `Transaction` yoziladi va so'rovga bog'lanadi.
 */
export async function tasdiqla(params: {
  businessId: string;
  requestId: string;
  tasdiqlovchi: { id: string; rol: string };
}) {
  const natija = await runBusinessTx(params.businessId, async (tx) => {
    const req = await tx.approvalRequest.findFirst({
      where: { id: params.requestId, businessId: params.businessId },
    });
    if (!req) throw new ForbiddenError("So'rov topilmadi");
    if (req.holat !== "kutilmoqda") {
      throw new BadRequestError(
        req.holat === "tasdiqlangan" ? "Bu so'rov allaqachon tasdiqlangan" : "Bu so'rov rad etilgan"
      );
    }
    if (req.userId === params.tasdiqlovchi.id) {
      throw new BadRequestError("O'z so'rovingizni o'zingiz tasdiqlay olmaysiz");
    }

    const qoida = req.ruleId
      ? await tx.approvalRule.findFirst({
          where: { id: req.ruleId, businessId: params.businessId },
          select: { tasdiqlovchiRol: true },
        })
      : null;
    const kerakli = qoida?.tasdiqlovchiRol ?? "OWNER";
    if (daraja(params.tasdiqlovchi.rol) < daraja(kerakli)) {
      throw new ForbiddenError("Bu so'rovni tasdiqlash sizning rolingizga ochiq emas");
    }

    const sanaStr = req.sana.toISOString().slice(0, 10);
    const txn = await createTransactionTx(tx, req.userId, params.businessId, {
      turi: "chiqim",
      categoryId: req.categoryId,
      summa: req.summa,
      sana: sanaStr,
      izoh: req.izoh,
      filial: req.filial,
      accountId: req.accountId,
    });

    return tx.approvalRequest.update({
      where: { id: req.id },
      data: {
        holat: "tasdiqlangan",
        tasdiqlovchiId: params.tasdiqlovchi.id,
        qarorSana: new Date(),
        transactionId: txn.id,
      },
    });
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "approvalRequest",
    entityId: params.requestId,
    after: { holat: "tasdiqlangan", transactionId: natija.transactionId },
  });
  return natija;
}

export async function radEt(params: {
  businessId: string;
  requestId: string;
  tasdiqlovchi: { id: string; rol: string };
  sabab: string;
}) {
  const req = await prisma.approvalRequest.findFirst({
    where: { id: params.requestId, businessId: params.businessId },
    include: { rule: { select: { tasdiqlovchiRol: true } } },
  });
  if (!req) throw new ForbiddenError("So'rov topilmadi");
  if (req.holat !== "kutilmoqda") throw new BadRequestError("Bu so'rov bo'yicha qaror chiqarilgan");

  const kerakli = req.rule?.tasdiqlovchiRol ?? "OWNER";
  if (daraja(params.tasdiqlovchi.rol) < daraja(kerakli)) {
    throw new ForbiddenError("Bu so'rovni rad etish sizning rolingizga ochiq emas");
  }

  const natija = await prisma.approvalRequest.update({
    where: { id: req.id },
    data: {
      holat: "rad",
      tasdiqlovchiId: params.tasdiqlovchi.id,
      qarorSana: new Date(),
      radSabab: params.sabab,
    },
  });

  await logAudit({
    businessId: params.businessId,
    action: "update",
    entity: "approvalRequest",
    entityId: req.id,
    after: { holat: "rad", sabab: params.sabab },
  });
  return natija;
}

/**
 * TAHRIRNI TEKSHIRISH (C-2) — `PATCH /api/transactions/[id]` uchun.
 *
 * Tasdiqlash qoidasi faqat yaratishda tekshirilsa, kassir chegaradan PAST
 * chiqim yozib, keyin PATCH bilan istalgan summaga oshira olardi — modul
 * butunlay aylanib o'tilardi. Shuning uchun moliyaviy maydon (summa,
 * kategoriya, turi, sana) o'zgarayotganda shu tekshiruv qo'llanadi.
 *
 * Xato tashlaydi (ForbiddenError):
 *  1) yozuv rahbar tasdig'i bilan yozilgan bo'lsa — tasdiqlangan raqam
 *     keyin o'zgartirilmaydi (faqat izoh/filial tahriri ruxsat);
 *  2) yangi qiymatlar bo'yicha tasdiqlash qoidasi topilsa — o'zgartirish
 *     rad etiladi, foydalanuvchi yangi chiqim sifatida yuboradi.
 */
export async function tahrirTasdiqniTekshir(params: {
  modulYoqilgan: boolean;
  businessId: string;
  transactionId: string;
  /** O'zgarishdan KEYINGI qiymatlar (berilmagani mavjudidan olinadi). */
  turi: string;
  categoryId: string;
  summa: number;
  sorovchiRol: string;
}): Promise<void> {
  const tasdiqIzi = await prisma.approvalRequest.findFirst({
    where: { transactionId: params.transactionId },
    select: { id: true },
  });
  if (tasdiqIzi) {
    throw new ForbiddenError(
      "Bu yozuv rahbar tasdig'i bilan yozilgan — summasi, kategoriyasi, turi va sanasini " +
        "o'zgartirib bo'lmaydi. Kerak bo'lsa yangi chiqim yuboring, rahbar tasdiqlaydi."
    );
  }

  if (!params.modulYoqilgan || params.turi !== "chiqim") return;

  const qoida = await mosQoidaniTop({
    businessId: params.businessId,
    categoryId: params.categoryId,
    summa: params.summa,
    sorovchiRol: params.sorovchiRol,
  });
  if (qoida) {
    throw new ForbiddenError(
      "Bu summa tasdiqlash chegarasidan oshadi — yozuvni o'zgartirib bo'lmaydi. " +
        "Yangi chiqim sifatida yuboring, rahbar tasdiqlaydi."
    );
  }
}

/**
 * CHIQIM KIRITISHNING YAGONA KIRISH NUQTASI (veb va bot ikkalasi uchun).
 *
 * Tasdiq kerak bo'lsa — tranzaksiya YOZILMAYDI, so'rov yaratiladi va
 * tasdiqlovchilarga Telegram xabar ketadi. Aks holda odatdagidek yoziladi.
 *
 * `modulYoqilgan` ataylab parametr: modul yoqiqligini chaqiruvchi allaqachon
 * biladi (veb — `getEnabledModules`, bot — `isModuleOnForTenant`), shu bois
 * bu yerda yashirin qo'shimcha so'rov yo'q.
 */
export async function chiqimYubor(params: {
  modulYoqilgan: boolean;
  businessId: string;
  user: { id: string; rol: string; ism: string };
  data: CreateTransactionData;
}): Promise<
  | { tasdiqKerak: false; transaction: Awaited<ReturnType<typeof createTransaction>> }
  | { tasdiqKerak: true; request: Awaited<ReturnType<typeof createRequest>>; chegara: number }
> {
  const { businessId, data } = params;

  if (params.modulYoqilgan && data.turi === "chiqim") {
    const qoida = await mosQoidaniTop({
      businessId,
      categoryId: data.categoryId,
      summa: data.summa,
      sorovchiRol: params.user.rol,
    });
    if (qoida) {
      const request = await createRequest({
        businessId,
        userId: params.user.id,
        qoida,
        data,
      });
      const kategoriya = await prisma.category.findFirst({
        where: { id: data.categoryId, businessId },
        select: { nomi: true },
      });
      await tasdiqSoroviniYubor({
        businessId,
        requestId: request.id,
        summa: request.summa,
        kategoriyaNomi: kategoriya?.nomi ?? "Chiqim",
        sorovchiIsm: params.user.ism,
        izoh: request.izoh,
        tasdiqlovchiRol: qoida.tasdiqlovchiRol,
      });
      return { tasdiqKerak: true, request, chegara: qoida.chegara };
    }
  }

  const transaction = await createTransaction(params.user.id, businessId, data);
  return { tasdiqKerak: false, transaction };
}

// ---------------------------------------------------------------------------
// Telegram xabarnomasi
// ---------------------------------------------------------------------------

/**
 * Tasdiqlovchilarga Telegramda inline tugmali xabar yuboradi.
 *
 * Ataylab "best-effort": Telegram ishlamasa ham so'rov bazada turaveradi va
 * veb-saytdagi "Tasdiqlash" sahifasida ko'rinadi. Shuning uchun xatolik
 * yuqoriga otilmaydi — chiqim kiritish jarayoni Telegram tufayli buzilmaydi.
 *
 * `rawPrisma` — bot xabarnomalari tizim darajasidagi amal (CLAUDE.md).
 */
export async function tasdiqSoroviniYubor(params: {
  businessId: string;
  requestId: string;
  summa: number;
  kategoriyaNomi: string;
  sorovchiIsm: string;
  izoh?: string | null;
  tasdiqlovchiRol: string;
}) {
  try {
    const biznes = await rawPrisma.business.findUnique({
      where: { id: params.businessId },
      select: { tenantId: true, nomi: true },
    });
    if (!biznes) return;

    const kerakliDaraja = daraja(params.tasdiqlovchiRol);
    const rollar = (["OWNER", "ADMIN"] as const).filter((r) => daraja(r) >= kerakliDaraja);

    const qabulQiluvchilar = await rawPrisma.user.findMany({
      where: {
        tenantId: biznes.tenantId,
        rol: { in: [...rollar] },
        isActive: true,
        telegramChatId: { not: null },
      },
      select: { telegramChatId: true },
    });
    if (qabulQiluvchilar.length === 0) return;

    const { bot } = await import("@/bot/bot");
    const matn =
      `🔔 Tasdiq kutilmoqda\n\n` +
      `${biznes.nomi} · ${params.kategoriyaNomi}\n` +
      `Summa: ${formatSom(params.summa)}\n` +
      `So'radi: ${params.sorovchiIsm}` +
      (params.izoh ? `\nIzoh: ${params.izoh}` : "");

    for (const q of qabulQiluvchilar) {
      try {
        await bot.api.sendMessage(q.telegramChatId!, matn, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Tasdiqlash", callback_data: `tsd:ok:${params.requestId}` },
                { text: "❌ Rad etish", callback_data: `tsd:no:${params.requestId}` },
              ],
            ],
          },
        });
      } catch (error) {
        console.error("Tasdiq so'rovini yuborishda xatolik:", error);
      }
    }
  } catch (error) {
    console.error("Tasdiq xabarnomasi tayyorlanmadi:", error);
  }
}
