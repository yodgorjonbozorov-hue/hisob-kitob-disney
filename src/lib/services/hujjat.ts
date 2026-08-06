import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import { havolaniTekshir, faylYukla } from "@/lib/storage/driver";
import type {
  CreateContractInput,
  HavolaIlovaInput,
  IlovaEntity,
  UpdateContractInput,
} from "@/lib/validation/hujjat";

// ---------------------------------------------------------------------------
// Shartnomalar
// ---------------------------------------------------------------------------

/** Kontragent bog'lanishini tekshiradi — begona kartochka biriktirilmasin. */
async function kontragentniTekshir(
  businessId: string,
  data: { contactId?: string | null; supplierId?: string | null }
) {
  if (data.contactId) {
    const c = await prisma.contact.findFirst({
      where: { id: data.contactId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!c) throw new ForbiddenError("Mijoz topilmadi");
  }
  if (data.supplierId) {
    const s = await prisma.supplier.findFirst({
      where: { id: data.supplierId, businessId, deletedAt: null },
      select: { id: true },
    });
    if (!s) throw new ForbiddenError("Ta'minotchi topilmadi");
  }
}

export async function createContract(
  businessId: string,
  userId: string,
  data: CreateContractInput
) {
  const mavjud = await prisma.contract.findFirst({
    where: { businessId, raqam: data.raqam, deletedAt: null },
    select: { id: true },
  });
  if (mavjud) throw new BadRequestError("Bu raqamdagi shartnoma allaqachon bor");

  if (data.tugash && data.tugash < data.boshlanish) {
    throw new BadRequestError("Tugash sanasi boshlanishdan oldin bo'lishi mumkin emas");
  }
  await kontragentniTekshir(businessId, data);

  const shartnoma = await prisma.contract.create({
    data: {
      businessId,
      raqam: data.raqam,
      nomi: data.nomi,
      turi: data.turi,
      contactId: data.contactId ?? null,
      supplierId: data.supplierId ?? null,
      kontragent: data.kontragent?.trim() || undefined,
      summa: data.summa,
      boshlanish: dateOnlyStringToUTCDate(data.boshlanish),
      tugash: data.tugash ? dateOnlyStringToUTCDate(data.tugash) : undefined,
      eslatmaKun: data.eslatmaKun,
      izoh: data.izoh?.trim() || undefined,
      userId,
    },
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "contract",
    entityId: shartnoma.id,
    after: { raqam: shartnoma.raqam, summa: shartnoma.summa },
  });
  return shartnoma;
}

export async function updateContract(
  businessId: string,
  id: string,
  data: UpdateContractInput
) {
  const mavjud = await prisma.contract.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Shartnoma topilmadi");

  if (data.raqam && data.raqam !== mavjud.raqam) {
    const band = await prisma.contract.findFirst({
      where: { businessId, raqam: data.raqam, deletedAt: null },
      select: { id: true },
    });
    if (band) throw new BadRequestError("Bu raqamdagi shartnoma allaqachon bor");
  }

  const boshlanish = data.boshlanish
    ? dateOnlyStringToUTCDate(data.boshlanish)
    : mavjud.boshlanish;
  const tugash =
    data.tugash !== undefined
      ? data.tugash
        ? dateOnlyStringToUTCDate(data.tugash)
        : null
      : mavjud.tugash;
  if (tugash && tugash < boshlanish) {
    throw new BadRequestError("Tugash sanasi boshlanishdan oldin bo'lishi mumkin emas");
  }
  await kontragentniTekshir(businessId, data);

  return prisma.contract.update({
    where: { id },
    data: {
      ...(data.raqam ? { raqam: data.raqam } : {}),
      ...(data.nomi ? { nomi: data.nomi } : {}),
      ...(data.turi ? { turi: data.turi } : {}),
      ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
      ...(data.supplierId !== undefined ? { supplierId: data.supplierId } : {}),
      ...(data.kontragent !== undefined ? { kontragent: data.kontragent?.trim() || null } : {}),
      ...(data.summa !== undefined ? { summa: data.summa } : {}),
      ...(data.boshlanish ? { boshlanish } : {}),
      ...(data.tugash !== undefined ? { tugash } : {}),
      ...(data.eslatmaKun !== undefined ? { eslatmaKun: data.eslatmaKun } : {}),
      ...(data.holat ? { holat: data.holat } : {}),
      ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
    },
  });
}

/** Yumshoq o'chirish — shartnoma tarixi va ilovalari saqlanadi. */
export async function deleteContract(businessId: string, id: string) {
  const mavjud = await prisma.contract.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Shartnoma topilmadi");

  await prisma.contract.update({ where: { id }, data: { deletedAt: new Date(), holat: "bekor" } });
  await logAudit({ businessId, action: "delete", entity: "contract", entityId: id });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ilovalar
// ---------------------------------------------------------------------------

/**
 * Ilova biriktirilayotgan yozuv shu biznesga tegishlimi.
 *
 * Polimorf bog'lanishda FK yo'q, shuning uchun egalik SHU YERDA tekshiriladi
 * — aks holda begona yozuvga ilova osib qo'yish mumkin bo'lardi.
 */
async function egalikniTekshir(businessId: string, entity: IlovaEntity, entityId: string) {
  const topildi = await (async () => {
    switch (entity) {
      case "transaction":
        return prisma.transaction.findFirst({ where: { id: entityId, businessId }, select: { id: true } });
      case "debt":
        return prisma.debt.findFirst({ where: { id: entityId, businessId }, select: { id: true } });
      case "deal":
        return prisma.deal.findFirst({ where: { id: entityId, businessId }, select: { id: true } });
      case "task":
        return prisma.task.findFirst({ where: { id: entityId, businessId }, select: { id: true } });
      case "contract":
        return prisma.contract.findFirst({ where: { id: entityId, businessId }, select: { id: true } });
    }
  })();
  if (!topildi) throw new ForbiddenError("Yozuv topilmadi yoki boshqa biznesga tegishli");
}

/** Tashqi havola sifatida biriktirish — saqlagich sozlanmagan bo'lsa ham ishlaydi. */
export async function havolaBiriktir(
  businessId: string,
  userId: string,
  data: HavolaIlovaInput
) {
  await egalikniTekshir(businessId, data.entity, data.entityId);
  const url = havolaniTekshir(data.url);

  return prisma.attachment.create({
    data: {
      businessId,
      entity: data.entity,
      entityId: data.entityId,
      nomi: data.nomi,
      url,
      saqlagich: "havola",
      userId,
    },
  });
}

/** Faylni saqlagichga yuklab biriktirish. Saqlagich sozlanmagan bo'lsa xato. */
export async function faylBiriktir(params: {
  businessId: string;
  userId: string;
  entity: IlovaEntity;
  entityId: string;
  nomi: string;
  mimeType: string;
  mazmun: Buffer;
}) {
  await egalikniTekshir(params.businessId, params.entity, params.entityId);
  const natija = await faylYukla({
    nomi: params.nomi,
    mimeType: params.mimeType,
    mazmun: params.mazmun,
  });

  return prisma.attachment.create({
    data: {
      businessId: params.businessId,
      entity: params.entity,
      entityId: params.entityId,
      nomi: params.nomi.slice(0, 200),
      url: natija.url,
      saqlagich: natija.saqlagich,
      mimeType: params.mimeType,
      hajm: params.mazmun.byteLength,
      userId: params.userId,
    },
  });
}

/**
 * Ilovani o'chirish — yumshoq.
 *
 * Saqlagichdagi fayl ataylab o'chirilmaydi: yozuv tasodifan o'chirilsa
 * havola tiklanishi kerak, va bir fayl bir necha yozuvga biriktirilgan
 * bo'lishi mumkin.
 */
export async function ilovaniOchir(businessId: string, id: string) {
  const mavjud = await prisma.attachment.findFirst({ where: { id, businessId, deletedAt: null } });
  if (!mavjud) throw new ForbiddenError("Ilova topilmadi");

  await prisma.attachment.update({ where: { id }, data: { deletedAt: new Date() } });
  return { ok: true };
}
