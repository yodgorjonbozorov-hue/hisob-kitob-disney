import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { isManager, type Rol } from "@/lib/auth/roles";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { dateOnlyStringToUTCDate, todayTashkentDateOnlyString } from "@/lib/date";
import { logAudit } from "@/lib/services/audit";
import {
  KUNLIK_TOLOV_TURLARI,
  type CreateKunlikTushumInput,
  type UpdateKunlikTushumInput,
} from "@/lib/validation/kunlik";

/**
 * KUNLIK HISOBOT xizmati.
 *
 * Invariantlar:
 *  - bir biznes + bir sana = BITTA hisobot (`@@unique([businessId, sana])`);
 *  - tushum HAR DOIM bugungi (Toshkent) hisobotga yoziladi — yo'q bo'lsa
 *    tranzaksiya ichida avtomatik yaratiladi;
 *  - summalar har mutatsiyada bazadagi tushumlardan qayta jamlanadi
 *    (frontend yuborgan songa ishonilmaydi);
 *  - CONFIRMED hisobotga yozib/o'zgartirib bo'lmaydi — avval qayta ochiladi;
 *  - barcha ko'p qadamli amallar `runBusinessTx` ichida (atomik), shuning
 *    uchun har so'rovda `businessId` QO'LDA yoziladi va audit qo'lda.
 */

export interface KunlikAktor {
  userId: string;
  ism: string | null;
  rol: Rol;
}

/** Kim nima qila oladi — sahifa va API'lar uchun yagona manba. */
export interface KunlikRuxsat {
  /** Shu biznes uchun tayinlangan direktormi. */
  direktormi: boolean;
  /** OWNER/ADMIN. */
  boshqaruvchimi: boolean;
  /** Kun yakunini tasdiqlay oladimi. */
  tasdiqlaydi: boolean;
  /** Tasdiqlangan kunni qayta ocha oladimi / istalgan tushumni tahrirlay oladimi. */
  tahrirlaydi: boolean;
  /** Tarix va istalgan kunni ko'ra oladimi (xodim faqat bugunni ko'radi). */
  tarixniKoradi: boolean;
}

export async function getKunlikRuxsat(businessId: string, aktor: KunlikAktor): Promise<KunlikRuxsat> {
  const sozlama = await prisma.dailyReportSetting.findFirst({
    where: { businessId },
    select: { direktorId: true },
  });
  const direktormi = !!sozlama?.direktorId && sozlama.direktorId === aktor.userId;
  const boshqaruvchimi = isManager(aktor.rol);
  return {
    direktormi,
    boshqaruvchimi,
    // Tasdiqlash — belgilangan direktorning huquqi. Direktor hali
    // tayinlanmagan bo'lsa, ish to'xtab qolmasligi uchun boshqaruvchi
    // vaqtincha tasdiqlay oladi (UI direktor tayinlashni taklif qiladi).
    tasdiqlaydi: direktormi || (!sozlama?.direktorId && boshqaruvchimi),
    tahrirlaydi: direktormi || boshqaruvchimi,
    tarixniKoradi: direktormi || boshqaruvchimi,
  };
}

/** Bugungi (Toshkent) sana — kunlik hisobot kalendari shu bo'yicha yuradi. */
export function kunlikBugun(): string {
  return todayTashkentDateOnlyString();
}

/**
 * Hisobot summalarini bazadagi tushumlardan qayta jamlaydi.
 * Tranzaksiya ICHIDA chaqiriladi — tushum yozish bilan jamlash atomik.
 */
async function jamlashTx(tx: BusinessTx, businessId: string, reportId: string): Promise<void> {
  const guruhlar = await tx.dailyTransaction.groupBy({
    by: ["tolovTuri"],
    where: { reportId, businessId, deletedAt: null },
    _sum: { summa: true },
  });
  const summa = (turi: string) => Number(guruhlar.find((g) => g.tolovTuri === turi)?._sum.summa ?? 0);
  const naqd = summa("CASH");
  const click = summa("CLICK");
  const qarz = summa("DEBT");
  await tx.dailyReport.updateMany({
    where: { id: reportId, businessId },
    data: {
      naqdSumma: naqd,
      clickSumma: click,
      qarzSumma: qarz,
      jamiSumma: naqd + click + qarz,
    },
  });
}

/**
 * Sana uchun hisobotni topadi yoki OPEN holatda yaratadi (tranzaksiya ichida).
 * `upsert` — ikki xodim bir vaqtda kiritganda dublikat report ochilmasligi
 * uchun (`businessId_sana` unique kaliti race'ni bazada hal qiladi).
 */
async function reportTopYokiYaratTx(tx: BusinessTx, businessId: string, sana: Date) {
  return tx.dailyReport.upsert({
    where: { businessId_sana: { businessId, sana } },
    create: { businessId, sana },
    update: {},
  });
}

/** Tushum kiritish — har doim BUGUNGI (Toshkent) hisobotga. */
export async function addKunlikTushum(
  businessId: string,
  aktor: KunlikAktor,
  data: CreateKunlikTushumInput
) {
  const sana = dateOnlyStringToUTCDate(kunlikBugun());

  const yozuv = await runBusinessTx(businessId, async (tx) => {
    const report = await reportTopYokiYaratTx(tx, businessId, sana);
    if (report.holat !== "OPEN") {
      throw new BadRequestError(
        "Bugungi kun yakuni tasdiqlangan — yangi tushum kiritib bo'lmaydi. " +
          "O'zgartirish kerak bo'lsa direktor kunni qayta ochishi mumkin."
      );
    }
    const tushum = await tx.dailyTransaction.create({
      data: {
        businessId,
        reportId: report.id,
        summa: data.summa,
        tolovTuri: data.tolovTuri,
        izoh: data.izoh?.trim() || undefined,
        userId: aktor.userId,
        userIsm: aktor.ism,
      },
    });
    await jamlashTx(tx, businessId, report.id);
    return tushum;
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "dailyTransaction",
    entityId: yozuv.id,
    after: { summa: data.summa, tolovTuri: data.tolovTuri, izoh: data.izoh ?? null },
  });
  return yozuv;
}

/**
 * Tushumni tahrirlash. OPEN hisobotda: kiritgan xodimning o'zi yoki
 * direktor/boshqaruvchi. CONFIRMED hisobotda umuman mumkin emas.
 */
export async function updateKunlikTushum(
  businessId: string,
  aktor: KunlikAktor,
  id: string,
  data: UpdateKunlikTushumInput
) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);

  const { eski, yangi } = await runBusinessTx(businessId, async (tx) => {
    const mavjud = await tx.dailyTransaction.findFirst({
      where: { id, businessId, deletedAt: null },
      include: { report: { select: { id: true, holat: true, businessId: true } } },
    });
    if (!mavjud || mavjud.report.businessId !== businessId) {
      throw new ForbiddenError("Tushum topilmadi");
    }
    if (mavjud.report.holat !== "OPEN") {
      throw new BadRequestError("Tasdiqlangan kun tushumini o'zgartirib bo'lmaydi — avval kunni qayta oching");
    }
    if (!ruxsat.tahrirlaydi && mavjud.userId !== aktor.userId) {
      throw new ForbiddenError("Faqat o'zingiz kiritgan tushumni o'zgartira olasiz");
    }
    await tx.dailyTransaction.updateMany({
      where: { id: mavjud.id, businessId },
      data: {
        ...(data.summa !== undefined ? { summa: data.summa } : {}),
        ...(data.tolovTuri !== undefined ? { tolovTuri: data.tolovTuri } : {}),
        ...(data.izoh !== undefined ? { izoh: data.izoh?.trim() || null } : {}),
      },
    });
    const yangi = (await tx.dailyTransaction.findFirst({ where: { id: mavjud.id, businessId } }))!;
    await jamlashTx(tx, businessId, mavjud.reportId);
    return { eski: mavjud, yangi };
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "dailyTransaction",
    entityId: id,
    before: { summa: eski.summa, tolovTuri: eski.tolovTuri, izoh: eski.izoh },
    after: { summa: yangi.summa, tolovTuri: yangi.tolovTuri, izoh: yangi.izoh },
  });
  return yangi;
}

/** Tushumni yumshoq o'chirish — jamidan chiqadi, tarixda qoladi. */
export async function deleteKunlikTushum(businessId: string, aktor: KunlikAktor, id: string) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);

  const eski = await runBusinessTx(businessId, async (tx) => {
    const mavjud = await tx.dailyTransaction.findFirst({
      where: { id, businessId, deletedAt: null },
      include: { report: { select: { id: true, holat: true } } },
    });
    if (!mavjud) throw new ForbiddenError("Tushum topilmadi");
    if (mavjud.report.holat !== "OPEN") {
      throw new BadRequestError("Tasdiqlangan kun tushumini o'chirib bo'lmaydi — avval kunni qayta oching");
    }
    if (!ruxsat.tahrirlaydi && mavjud.userId !== aktor.userId) {
      throw new ForbiddenError("Faqat o'zingiz kiritgan tushumni o'chira olasiz");
    }
    await tx.dailyTransaction.updateMany({
      where: { id: mavjud.id, businessId },
      data: { deletedAt: new Date() },
    });
    await jamlashTx(tx, businessId, mavjud.reportId);
    return mavjud;
  });

  await logAudit({
    businessId,
    action: "delete",
    entity: "dailyTransaction",
    entityId: id,
    before: { summa: eski.summa, tolovTuri: eski.tolovTuri, izoh: eski.izoh },
  });
  return { ok: true };
}

/**
 * KUN YAKUNINI TASDIQLASH.
 *
 * Faqat tayinlangan direktor (direktor yo'q bo'lsa — boshqaruvchi).
 * `updateMany` + `holat: "OPEN"` sharti — bir kunni ikki marta tasdiqlash
 * race'ini bazada yopadi: ikkinchi urinishda count 0 bo'ladi.
 */
export async function confirmKunlikReport(businessId: string, aktor: KunlikAktor, sanaStr: string) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);
  if (!ruxsat.tasdiqlaydi) {
    throw new ForbiddenError("Kun yakunini faqat tayinlangan direktor tasdiqlaydi");
  }
  const bugun = kunlikBugun();
  if (sanaStr > bugun) throw new BadRequestError("Kelajak kunni tasdiqlab bo'lmaydi");
  const sana = dateOnlyStringToUTCDate(sanaStr);

  const report = await runBusinessTx(businessId, async (tx) => {
    // Tushumsiz kun ham yakunlanishi mumkin (0 so'm bilan) — report ochamiz.
    const r = await reportTopYokiYaratTx(tx, businessId, sana);
    await jamlashTx(tx, businessId, r.id);
    const natija = await tx.dailyReport.updateMany({
      where: { id: r.id, businessId, holat: "OPEN" },
      data: {
        holat: "CONFIRMED",
        confirmedBy: aktor.userId,
        confirmedByIsm: aktor.ism,
        confirmedAt: new Date(),
      },
    });
    if (natija.count === 0) {
      throw new BadRequestError("Bu kun allaqachon tasdiqlangan");
    }
    return tx.dailyReport.findFirst({ where: { id: r.id, businessId } });
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "dailyReport",
    entityId: report!.id,
    before: { holat: "OPEN" },
    after: { holat: "CONFIRMED", sana: sanaStr, jamiSumma: report!.jamiSumma },
  });
  return report!;
}

/**
 * Tasdiqlangan kunni QAYTA OCHISH — tuzatish kiritish uchun.
 * Faqat direktor yoki boshqaruvchi. Tuzatishdan keyin kun qayta tasdiqlanadi.
 */
export async function reopenKunlikReport(businessId: string, aktor: KunlikAktor, sanaStr: string) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);
  if (!ruxsat.tahrirlaydi) {
    throw new ForbiddenError("Tasdiqlangan kunni faqat direktor yoki boshqaruvchi qayta ochadi");
  }
  const sana = dateOnlyStringToUTCDate(sanaStr);

  const report = await runBusinessTx(businessId, async (tx) => {
    const r = await tx.dailyReport.findFirst({ where: { businessId, sana } });
    if (!r) throw new BadRequestError("Bu kun uchun hisobot yo'q");
    const natija = await tx.dailyReport.updateMany({
      where: { id: r.id, businessId, holat: "CONFIRMED" },
      data: { holat: "OPEN", confirmedBy: null, confirmedByIsm: null, confirmedAt: null },
    });
    if (natija.count === 0) throw new BadRequestError("Bu kun tasdiqlanmagan — ochish shart emas");
    return tx.dailyReport.findFirst({ where: { id: r.id, businessId } });
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "dailyReport",
    entityId: report!.id,
    before: { holat: "CONFIRMED" },
    after: { holat: "OPEN", sana: sanaStr },
  });
  return report!;
}

/**
 * Direktor tayinlash (yoki null bilan olib tashlash) — faqat boshqaruvchi
 * (route'da requireManager). Direktor SHU tenantdagi faol foydalanuvchi
 * bo'lishi shart; kassir bo'lsa — aynan shu biznesga biriktirilgan bo'lishi kerak.
 */
export async function setKunlikDirektor(businessId: string, direktorId: string | null) {
  let direktorIsm: string | null = null;
  if (direktorId) {
    // `prisma.user` tenant-scoped (TENANT_DIRECT) — begona tenant foydalanuvchisi topilmaydi.
    const user = await prisma.user.findFirst({
      where: { id: direktorId, isActive: true },
      select: { id: true, ism: true, rol: true, businessId: true },
    });
    if (!user) throw new BadRequestError("Foydalanuvchi topilmadi yoki nofaol");
    if (user.rol === "SUPERADMIN") throw new BadRequestError("Bu foydalanuvchini direktor qilib bo'lmaydi");
    if (user.businessId && user.businessId !== businessId) {
      throw new BadRequestError("Bu foydalanuvchi boshqa biznesga biriktirilgan");
    }
    direktorIsm = user.ism;
  }

  const eski = await prisma.dailyReportSetting.findFirst({ where: { businessId } });
  const sozlama = eski
    ? await prisma.dailyReportSetting.update({ where: { id: eski.id }, data: { direktorId } })
    : await prisma.dailyReportSetting.create({ data: { businessId, direktorId } });

  await logAudit({
    businessId,
    action: eski ? "update" : "create",
    entity: "dailyReportSetting",
    entityId: sozlama.id,
    before: eski ? { direktorId: eski.direktorId } : undefined,
    after: { direktorId, direktorIsm },
  });
  return sozlama;
}

/** Sxemadagi to'lov turlari haqiqatan qamrab olinganini testda tekshirish uchun. */
export const KUNLIK_TURLAR_ICHKI = KUNLIK_TOLOV_TURLARI;
