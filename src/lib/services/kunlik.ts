import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { formatSomLabel } from "@/lib/format";
import { isManager, MANAGER_ROLLAR, type Rol } from "@/lib/auth/roles";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import {
  dateOnlyStringToUTCDate,
  monthRangeUTC,
  todayTashkentDateOnlyString,
  utcDateToDateOnlyString,
} from "@/lib/date";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { logAudit } from "@/lib/services/audit";
import {
  KUNLIK_TOLOV_TURLARI,
  type CreateKunlikTushumInput,
  type KunlikTolovTuri,
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
 * Sana mantiqiy chegarada ekanini tekshiradi (C-4): biznes yaratilishidan
 * OLDINGI kunga hisobot ochib bo'lmaydi — aks holda tarixga soxta kun kiradi.
 * Tranzaksiya ichida chaqiriladi (report yaratilishidan oldin).
 */
async function sanaChegarasiniTekshirTx(tx: BusinessTx, businessId: string, sanaStr: string): Promise<void> {
  const biznes = await tx.business.findFirst({
    where: { id: businessId },
    select: { createdAt: true },
  });
  if (!biznes) throw new ForbiddenError("Biznes topilmadi");
  // createdAt — vaqt belgisi; Toshkent kalendariga o'girib date-only solishtiramiz.
  const boshlanish = todayTashkentDateOnlyString(biznes.createdAt);
  if (sanaStr < boshlanish) {
    throw new BadRequestError("Bu sana biznes ochilishidan oldin — hisobot ochib bo'lmaydi");
  }
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
        report.holat === "SUBMITTED"
          ? "Bugungi kassa direktorga topshirilgan — yangi tushum kiritib bo'lmaydi. " +
            "Kerak bo'lsa direktor kunni qayta ochadi."
          : report.holat === "LOCKED"
            ? "Bu kun yopilgan (davr qulflangan) — endi o'zgartirib bo'lmaydi."
            : "Bugungi kun yakuni tasdiqlangan — yangi tushum kiritib bo'lmaydi. " +
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
      throw new BadRequestError(
        mavjud.report.holat === "LOCKED"
          ? "Bu kun yopilgan (davr qulflangan) — endi o'zgartirib bo'lmaydi"
          : "Tasdiqlangan kun tushumini o'zgartirib bo'lmaydi — avval kunni qayta oching"
      );
    }
    if (mavjud.transactionId) {
      // Yozuvlardan ulangan tushum kunlikda tahrirlanmaydi — aks holda ikkala
      // tomon ajralib ketadi. Manba — Transaction, o'sha yerda o'zgartiriladi.
      throw new BadRequestError("Bu tushum Yozuvlardan avtomatik ulangan — uni Yozuvlar bo'limida o'zgartiring");
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
      throw new BadRequestError(
        mavjud.report.holat === "LOCKED"
          ? "Bu kun yopilgan (davr qulflangan) — endi o'zgartirib bo'lmaydi"
          : "Tasdiqlangan kun tushumini o'chirib bo'lmaydi — avval kunni qayta oching"
      );
    }
    if (mavjud.transactionId) {
      throw new BadRequestError("Bu tushum Yozuvlardan avtomatik ulangan — uni Yozuvlar bo'limida o'chiring");
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
 * KASSA TOPSHIRISH — xodim kun oxirida kunni direktorga yuboradi.
 *
 * Pul nazorati talabi: xodim kassadagi naqdni SANAB (`sanalganNaqd`) kiritadi.
 * Direktor tizim hisoblagan `naqdSumma` bilan solishtiradi — kam chiqsa pul
 * yo'qolgani (yoki kiritilmagan tushum) darhol ko'rinadi.
 *
 * Topshirilgandan keyin tushum kiritilmaydi (holat OPEN emas) — raqamlar
 * "muzlaydi". `updateMany` + `holat: "OPEN"` sharti ikki marta topshirish
 * race'ini bazada yopadi. Har qanday faol xodim topshira oladi.
 */
export async function submitKunlikReport(
  businessId: string,
  aktor: KunlikAktor,
  sanaStr: string,
  sanalganNaqd: number
) {
  const bugun = kunlikBugun();
  if (sanaStr > bugun) throw new BadRequestError("Kelajak kunni topshirib bo'lmaydi");
  // O'tgan kunni faqat direktor/boshqaruvchi topshiradi (C-4): oddiy xodim
  // istalgan eski sanani yuborib tarixga soxta kun kiritishi va uni
  // muzlatishi mumkin edi (`reportTopYokiYaratTx` yo'q kunni YARATADI).
  const ruxsat = await getKunlikRuxsat(businessId, aktor);
  if (sanaStr !== bugun && !ruxsat.tahrirlaydi) {
    throw new ForbiddenError("Faqat bugungi kunni topshirish mumkin");
  }
  const sana = dateOnlyStringToUTCDate(sanaStr);

  const report = await runBusinessTx(businessId, async (tx) => {
    await sanaChegarasiniTekshirTx(tx, businessId, sanaStr);
    const r = await reportTopYokiYaratTx(tx, businessId, sana);
    await jamlashTx(tx, businessId, r.id);
    const natija = await tx.dailyReport.updateMany({
      where: { id: r.id, businessId, holat: "OPEN" },
      data: {
        holat: "SUBMITTED",
        submittedBy: aktor.userId,
        submittedByIsm: aktor.ism,
        submittedAt: new Date(),
        sanalganNaqd,
      },
    });
    if (natija.count === 0) {
      const joriy = await tx.dailyReport.findFirst({
        where: { id: r.id, businessId },
        select: { holat: true },
      });
      throw new BadRequestError(
        joriy?.holat === "LOCKED"
          ? "Bu kun yopilgan (davr qulflangan)"
          : joriy?.holat === "CONFIRMED"
            ? "Bu kun allaqachon tasdiqlangan"
            : "Bu kun allaqachon direktorga topshirilgan"
      );
    }
    return (await tx.dailyReport.findFirst({ where: { id: r.id, businessId } }))!;
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "dailyReport",
    entityId: report.id,
    before: { holat: "OPEN" },
    after: {
      holat: "SUBMITTED",
      sana: sanaStr,
      jamiSumma: report.jamiSumma,
      naqdSumma: report.naqdSumma,
      sanalganNaqd,
      farq: sanalganNaqd - report.naqdSumma,
    },
  });

  // Direktorga darhol xabar (best-effort — Telegram ishlamasa jarayon buzilmaydi).
  await kunlikTopshirildiYubor(businessId, report, aktor.ism);

  return report;
}

/**
 * KUN YAKUNINI TASDIQLASH.
 *
 * Faqat tayinlangan direktor (direktor yo'q bo'lsa — boshqaruvchi).
 * OPEN (xodim topshirmagan bo'lsa ham direktor yopishi mumkin) va
 * SUBMITTED holatlardan o'tadi. `updateMany` + holat sharti — bir kunni
 * ikki marta tasdiqlash race'ini bazada yopadi (ikkinchisida count 0).
 */
export async function confirmKunlikReport(businessId: string, aktor: KunlikAktor, sanaStr: string) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);
  if (!ruxsat.tasdiqlaydi) {
    throw new ForbiddenError("Kun yakunini faqat tayinlangan direktor tasdiqlaydi");
  }
  const bugun = kunlikBugun();
  if (sanaStr > bugun) throw new BadRequestError("Kelajak kunni tasdiqlab bo'lmaydi");
  const sana = dateOnlyStringToUTCDate(sanaStr);

  const { report, oldingiHolat } = await runBusinessTx(businessId, async (tx) => {
    // Tushumsiz kun ham yakunlanishi mumkin (0 so'm bilan) — report ochamiz,
    // lekin sana biznes ochilishidan oldin bo'lmasin (soxta tarix — C-4).
    await sanaChegarasiniTekshirTx(tx, businessId, sanaStr);
    const r = await reportTopYokiYaratTx(tx, businessId, sana);
    // SUBMITTED kunda summalar "muzlagan" — baribir qayta jamlaymiz (himoya).
    await jamlashTx(tx, businessId, r.id);
    const natija = await tx.dailyReport.updateMany({
      where: { id: r.id, businessId, holat: { in: ["OPEN", "SUBMITTED"] } },
      data: {
        holat: "CONFIRMED",
        confirmedBy: aktor.userId,
        confirmedByIsm: aktor.ism,
        confirmedAt: new Date(),
      },
    });
    if (natija.count === 0) {
      throw new BadRequestError(
        r.holat === "LOCKED"
          ? "Bu kun yopilgan (davr qulflangan)"
          : "Bu kun allaqachon tasdiqlangan"
      );
    }
    return {
      report: (await tx.dailyReport.findFirst({ where: { id: r.id, businessId } }))!,
      oldingiHolat: r.holat,
    };
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "dailyReport",
    entityId: report.id,
    before: { holat: oldingiHolat },
    after: {
      holat: "CONFIRMED",
      sana: sanaStr,
      jamiSumma: report.jamiSumma,
      sanalganNaqd: report.sanalganNaqd,
      farq: report.sanalganNaqd === null ? null : report.sanalganNaqd - report.naqdSumma,
    },
  });
  return report;
}

/**
 * Yakunlangan (topshirilgan yoki tasdiqlangan) kunni QAYTA OCHISH — tuzatish
 * uchun. Faqat direktor yoki boshqaruvchi, MAJBURIY sabab bilan (M-9).
 * Topshiruv ma'lumotlari ham tozalanadi: tuzatishdan keyin xodim kassani
 * QAYTA sanab topshiradi. LOCKED kun ochilmaydi — yopilgan davr qaytmaydi (M-10).
 */
export async function reopenKunlikReport(
  businessId: string,
  aktor: KunlikAktor,
  sanaStr: string,
  sabab: string
) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);
  if (!ruxsat.tahrirlaydi) {
    throw new ForbiddenError("Yakunlangan kunni faqat direktor yoki boshqaruvchi qayta ochadi");
  }
  const tozaSabab = sabab.trim();
  if (tozaSabab.length < 5) {
    throw new BadRequestError("Qayta ochish sababi yozilishi shart (kamida 5 belgi)");
  }
  const sana = dateOnlyStringToUTCDate(sanaStr);

  const { report, oldingiHolat } = await runBusinessTx(businessId, async (tx) => {
    const r = await tx.dailyReport.findFirst({ where: { businessId, sana } });
    if (!r) throw new BadRequestError("Bu kun uchun hisobot yo'q");
    if (r.holat === "LOCKED") {
      throw new BadRequestError("Bu kun yopilgan (davr qulflangan) — qayta ochib bo'lmaydi");
    }
    const natija = await tx.dailyReport.updateMany({
      where: { id: r.id, businessId, holat: { in: ["SUBMITTED", "CONFIRMED"] } },
      data: {
        holat: "OPEN",
        confirmedBy: null,
        confirmedByIsm: null,
        confirmedAt: null,
        submittedBy: null,
        submittedByIsm: null,
        submittedAt: null,
        sanalganNaqd: null,
        qaytaOchishSabab: tozaSabab,
      },
    });
    if (natija.count === 0) throw new BadRequestError("Bu kun yakunlanmagan — ochish shart emas");
    return {
      report: (await tx.dailyReport.findFirst({ where: { id: r.id, businessId } }))!,
      oldingiHolat: r.holat,
    };
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "dailyReport",
    entityId: report.id,
    before: { holat: oldingiHolat },
    after: { holat: "OPEN", sana: sanaStr, sabab: tozaSabab },
  });
  return report;
}

/**
 * OYNI YOPISH (M-10) — oy ichidagi barcha CONFIRMED kunlar LOCKED bo'ladi.
 * Qaytarib bo'lmaydi: LOCKED kun qayta ochilmaydi ham, o'zgartirilmaydi ham.
 * OPEN/SUBMITTED kunlarga tegilmaydi — ular avval tasdiqlanishi kerak.
 */
export async function oyniYop(businessId: string, aktor: KunlikAktor, oy: string) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);
  if (!ruxsat.tahrirlaydi) {
    throw new ForbiddenError("Oyni faqat direktor yoki boshqaruvchi yopadi");
  }
  const { from, to } = monthRangeUTC(oy);

  const natija = await runBusinessTx(businessId, (tx) =>
    tx.dailyReport.updateMany({
      where: { businessId, holat: "CONFIRMED", sana: { gte: from, lt: to } },
      data: { holat: "LOCKED" },
    })
  );

  await logAudit({
    businessId,
    action: "update",
    entity: "dailyReport",
    entityId: `oy:${oy}`,
    after: { holat: "LOCKED", oy, qulflandi: natija.count },
  });
  return { qulflandi: natija.count };
}

/**
 * AVTO QULFLASH (cron, M-10): CONFIRMED bo'lganidan `qulflashKun` kun o'tgan
 * hisobotlar LOCKED bo'ladi. Tenant kontekstida chaqiriladi (tenantlarBoylab).
 * qulflashKun = 0 — biznes uchun avto qulflash o'chirilgan.
 */
export async function kunlikAvtoQulfla(now: Date = new Date()): Promise<number> {
  const bizneslar = await prisma.business.findMany({ select: { id: true } });
  const sozlamalar = await prisma.dailyReportSetting.findMany({
    select: { businessId: true, qulflashKun: true },
  });
  const kunMap = new Map(sozlamalar.map((s) => [s.businessId, s.qulflashKun]));

  let jami = 0;
  for (const b of bizneslar) {
    const kun = kunMap.get(b.id) ?? 7;
    if (kun <= 0) continue;
    const chegara = new Date(now.getTime() - kun * 24 * 60 * 60 * 1000);
    const res = await prisma.dailyReport.updateMany({
      where: { businessId: b.id, holat: "CONFIRMED", confirmedAt: { lt: chegara } },
      data: { holat: "LOCKED" },
    });
    jami += res.count;
  }
  return jami;
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

// ---------------------------------------------------------------------------
// YOZUVLAR (Transaction) BILAN AVTO-SINXRON.
//
// Talab: xodim oddiy kirimni Yozuvlar formasidan kiritsa ham u kunlik
// hisobotga o'zi tushsin — LEKIN faqat sana BUGUNGI (Toshkent) bo'lsa.
// Boshqa (eski) sana tanlangan yozuv kunlikka tushmaydi.
//
// Sinxron hech qachon asosiy pul yozuvini buzmaydi: xato bo'lsa console'ga
// yoziladi va jimgina o'tiladi (kunlik — hosila ko'rinish, Transaction —
// haqiqat manbai). Tasdiqlangan (CONFIRMED) kunga ham tegilmaydi.
// ---------------------------------------------------------------------------

/** Kassa turi -> kunlik to'lov turi. Plastik ham, bank ham karta/onlayn tushum — Click. */
const KASSA_TOLOV_XARITASI: Record<string, KunlikTolovTuri> = {
  naqd: "CASH",
  plastik: "CLICK",
  bank: "CLICK",
};

export interface KunlikSinxronYozuv {
  id: string;
  businessId: string;
  turi: string;
  summa: number;
  sana: Date;
  izoh: string | null;
  userId: string;
  accountId: string | null;
  deletedAt: Date | null;
}

async function tolovTuriniAniqlaTx(
  tx: BusinessTx,
  businessId: string,
  accountId: string | null
): Promise<KunlikTolovTuri> {
  if (!accountId) return "CASH";
  const acc = await tx.account.findFirst({
    where: { id: accountId, businessId },
    select: { turi: true },
  });
  return KASSA_TOLOV_XARITASI[acc?.turi ?? "naqd"] ?? "CASH";
}

/**
 * Bitta tranzaksiyani kunlik hisobot bilan sinxronlaydi.
 * Yaratish, tahrirlash, o'chirish va tiklashdan keyin chaqiriladi:
 *  - bugungi sanali, o'chirilmagan KIRIM  -> kunlikda bo'lishi kerak;
 *  - qolgan har qanday holat              -> kunlikda bo'lmasligi kerak.
 */
export async function kunlikSinxron(t: KunlikSinxronYozuv, userIsm: string | null): Promise<void> {
  try {
    if (!(await isModuleOnForTenant(currentTenantId(), "KUNLIK"))) return;

    const kerak =
      t.turi === "kirim" && !t.deletedAt && utcDateToDateOnlyString(t.sana) === kunlikBugun();

    const amal = await runBusinessTx(t.businessId, async (tx) => {
      // deletedAt filtrsiz: transactionId UNIQUE, shuning uchun yumshoq
      // o'chirilgan ulangan yozuv ham topilib, tiklashda QAYTA OCHILADI
      // (yangi create UNIQUE cheklovga urilardi).
      const mavjud = await tx.dailyTransaction.findFirst({
        where: { transactionId: t.id, businessId: t.businessId },
        include: { report: { select: { id: true, holat: true } } },
      });

      if (kerak && !mavjud) {
        const report = await reportTopYokiYaratTx(tx, t.businessId, t.sana);
        if (report.holat !== "OPEN") return null; // kun yopilgan — jimgina o'tiladi
        const yangi = await tx.dailyTransaction.create({
          data: {
            businessId: t.businessId,
            reportId: report.id,
            summa: t.summa,
            tolovTuri: await tolovTuriniAniqlaTx(tx, t.businessId, t.accountId),
            izoh: t.izoh ?? undefined,
            userId: t.userId,
            userIsm,
            transactionId: t.id,
          },
        });
        await jamlashTx(tx, t.businessId, report.id);
        return { action: "create" as const, id: yangi.id };
      }

      if (!kerak && mavjud && !mavjud.deletedAt) {
        if (mavjud.report.holat !== "OPEN") return null;
        await tx.dailyTransaction.updateMany({
          where: { id: mavjud.id, businessId: t.businessId },
          data: { deletedAt: new Date() },
        });
        await jamlashTx(tx, t.businessId, mavjud.reportId);
        return { action: "delete" as const, id: mavjud.id };
      }

      if (kerak && mavjud) {
        // Yozuv boshqa kunning hisobotida turgan bo'lishi mumkin (sana keyin
        // bugunga o'zgartirilgan) — bugungi hisobotga KO'CHIRILADI. Ikkala
        // kun ham ochiq bo'lishi shart, aks holda tegilmaydi.
        const target = await reportTopYokiYaratTx(tx, t.businessId, t.sana);
        if (mavjud.report.holat !== "OPEN" || target.holat !== "OPEN") return null;
        await tx.dailyTransaction.updateMany({
          where: { id: mavjud.id, businessId: t.businessId },
          data: {
            reportId: target.id,
            summa: t.summa,
            izoh: t.izoh,
            tolovTuri: await tolovTuriniAniqlaTx(tx, t.businessId, t.accountId),
            deletedAt: null,
          },
        });
        await jamlashTx(tx, t.businessId, target.id);
        if (mavjud.reportId !== target.id) {
          await jamlashTx(tx, t.businessId, mavjud.reportId);
        }
        return { action: mavjud.deletedAt ? ("restore" as const) : ("update" as const), id: mavjud.id };
      }

      return null;
    });

    if (amal) {
      await logAudit({
        businessId: t.businessId,
        action: amal.action,
        entity: "dailyTransaction",
        entityId: amal.id,
        after: { transactionId: t.id, summa: t.summa, sinxron: true },
      });
    }
  } catch (e) {
    // Kunlik sinxron xatosi asosiy yozuvni BUZMAYDI.
    console.error("kunlikSinxron xatosi:", e);
  }
}

/**
 * Ommaviy o'chirish/ko'chirishdan keyin: shu tranzaksiyalarga ulangan kunlik
 * tushumlarni olib tashlaydi (faqat OCHIQ kunlardan). Modul holatidan qat'i
 * nazar ishlaydi — jami raqamlar halol qolishi kerak.
 */
export async function kunlikBulkUz(businessId: string, transactionIds: string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  try {
    await runBusinessTx(businessId, async (tx) => {
      const ulanganlar = await tx.dailyTransaction.findMany({
        where: { businessId, transactionId: { in: transactionIds }, deletedAt: null },
        include: { report: { select: { id: true, holat: true } } },
      });
      const ochiqlar = ulanganlar.filter((u) => u.report.holat === "OPEN");
      if (ochiqlar.length === 0) return;
      await tx.dailyTransaction.updateMany({
        where: { id: { in: ochiqlar.map((u) => u.id) }, businessId },
        data: { deletedAt: new Date() },
      });
      for (const reportId of new Set(ochiqlar.map((u) => u.reportId))) {
        await jamlashTx(tx, businessId, reportId);
      }
    });
  } catch (e) {
    console.error("kunlikBulkUz xatosi:", e);
  }
}

// ---------------------------------------------------------------------------
// Telegram xabarnomasi: kassa topshirildi — direktor tasdiqlashi kerak.
// ---------------------------------------------------------------------------

interface TopshirilganReport {
  id: string;
  businessId: string;
  sana: Date;
  naqdSumma: number;
  clickSumma: number;
  qarzSumma: number;
  jamiSumma: number;
  sanalganNaqd: number | null;
}

/**
 * Xodim kassani topshirganda direktorga darhol Telegram xabar + bir bosishda
 * tasdiqlash tugmasi (`kht:ok:` — bot/kunlikFlow.ts) yuboradi. Sanalgan naqd
 * bilan tizim hisobi solishtirilib, FARQ alohida ko'rsatiladi — pul nazorati
 * aynan shu qator uchun.
 *
 * "Best-effort" (approval uslubi): Telegram ishlamasa topshiruv baribir
 * bazada turadi va saytda ko'rinadi. `rawPrisma` — bot xabarnomalari tizim
 * darajasidagi amal (CLAUDE.md).
 */
async function kunlikTopshirildiYubor(
  businessId: string,
  report: TopshirilganReport,
  topshirganIsm: string | null
): Promise<void> {
  try {
    const biznes = await rawPrisma.business.findUnique({
      where: { id: businessId },
      select: { tenantId: true, nomi: true },
    });
    if (!biznes) return;

    // Qabul qiluvchi: tayinlangan direktor; Telegramsiz bo'lsa — boshqaruvchilar.
    const chatlar: string[] = [];
    const sozlama = await rawPrisma.dailyReportSetting.findUnique({
      where: { businessId },
      select: { direktorId: true },
    });
    if (sozlama?.direktorId) {
      const direktor = await rawPrisma.user.findFirst({
        where: { id: sozlama.direktorId, isActive: true, telegramChatId: { not: null } },
        select: { telegramChatId: true },
      });
      if (direktor?.telegramChatId) chatlar.push(direktor.telegramChatId);
    }
    if (chatlar.length === 0) {
      const managers = await rawPrisma.user.findMany({
        where: {
          tenantId: biznes.tenantId,
          rol: { in: [...MANAGER_ROLLAR] },
          isActive: true,
          telegramChatId: { not: null },
        },
        select: { telegramChatId: true },
      });
      for (const m of managers) if (m.telegramChatId) chatlar.push(m.telegramChatId);
    }
    if (chatlar.length === 0) return;

    const sanalgan = report.sanalganNaqd ?? 0;
    const farq = sanalgan - report.naqdSumma;
    const farqQator =
      farq === 0
        ? "✅ Farq yo'q — kassa tizim bilan mos"
        : farq < 0
          ? `⚠️ KAM: ${formatSomLabel(-farq)} yetishmayapti!`
          : `⚠️ Ortiqcha: ${formatSomLabel(farq)}`;

    const matn =
      `📤 Kassa topshirildi — tasdiqlash kerak\n\n` +
      `${biznes.nomi} — ${utcDateToDateOnlyString(report.sana).split("-").reverse().join(".")}\n` +
      `Topshirdi: ${topshirganIsm ?? "—"}\n\n` +
      `💵 Naqd (tizim): ${formatSomLabel(report.naqdSumma)}\n` +
      `💵 Naqd (sanaldi): ${formatSomLabel(sanalgan)}\n` +
      `${farqQator}\n\n` +
      `💳 Click: ${formatSomLabel(report.clickSumma)}\n` +
      `📋 Qarz: ${formatSomLabel(report.qarzSumma)}\n` +
      `💰 Jami: ${formatSomLabel(report.jamiSumma)}`;

    const { bot } = await import("@/bot/bot");
    for (const chatId of chatlar) {
      try {
        await bot.api.sendMessage(chatId, matn, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Kun yakunini tasdiqlash", callback_data: `kht:ok:${report.id}` }],
            ],
          },
        });
      } catch (error) {
        console.error("Kunlik topshiruv xabarini yuborishda xatolik:", error);
      }
    }
  } catch (error) {
    console.error("Kunlik topshiruv xabarnomasi tayyorlanmadi:", error);
  }
}

/** Sxemadagi to'lov turlari haqiqatan qamrab olinganini testda tekshirish uchun. */
export const KUNLIK_TURLAR_ICHKI = KUNLIK_TOLOV_TURLARI;
