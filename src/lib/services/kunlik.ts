import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { formatSomLabel } from "@/lib/format";
import { isManager, MANAGER_ROLLAR, type Rol } from "@/lib/auth/roles";
import { runBusinessTx, type BusinessTx } from "@/lib/db/businessTx";
import { currentTenantId } from "@/lib/db/tenantContext";
import {
  dateOnlyStringToUTCDate,
  todayTashkentDateOnlyString,
  utcDateToDateOnlyString,
} from "@/lib/date";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { logAudit } from "@/lib/services/audit";
import { ensureCategoryTx } from "@/lib/services/inventory";
import { createTransactionTx } from "@/lib/services/transactionService";
import {
  kunTopshiriqOrqagaTx,
  kunTopshiriqQabulTx,
  kunTopshiriqYaratTx,
  topshiruvchiKassaTx,
} from "@/lib/services/kunlikKassa";
import {
  KUNLIK_TOLOV_TURLARI,
  type CreateKunlikTushumInput,
  type KunlikQarorInput,
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
    /*
     * TASDIQLASH HUQUQI — tayinlangan direktor YOKI boshqaruvchi (OWNER/ADMIN).
     *
     * Ilgari boshqaruvchi faqat direktor TAYINLANMAGAN bo'lsa tasdiqlay
     * olardi. Bu kichik do'konlarda boshi berk ko'chaga olib kelardi:
     * direktor etib tayinlangan kassirning O'ZI kunni topshirsa,
     * "o'zini o'zi tasdiqlash" taqiqi ishga tushadi va kunni yopadigan
     * hech kim qolmasdi. Egasi baribir direktorni bir bosishda
     * almashtira oladi, ya'ni cheklovning xavfsizlik qiymati yo'q edi —
     * faqat ishni to'xtatardi.
     *
     * Nazorat esa `qarorKunlikReport` dagi O'ZINI O'ZI TASDIQLASH taqiqida
     * qoladi: topshirgan xodim (boshqaruvchi bo'lmasa) o'z topshirig'ini
     * yopa olmaydi.
     */
    tasdiqlaydi: direktormi || boshqaruvchimi,
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

/**
 * "Tushum kiritish" uchun zaxira kategoriya — foydalanuvchi kategoriya
 * tanlamagan holat uchun (bot, eski chaqiruvlar). Yangi kategoriya tizimi
 * QURILMAYDI: Kirim modulining o'z jadvalidan foydalaniladi.
 */
export const KUNLIK_ZAXIRA_KATEGORIYA = "Kunlik tushum";

/**
 * Tanlangan kategoriyani tekshiradi (shu biznes + KIRIM), tanlanmagan bo'lsa
 * zaxira kategoriyani topadi/yaratadi.
 */
async function tushumKategoriyaTx(
  tx: BusinessTx,
  businessId: string,
  categoryId?: string
): Promise<string> {
  if (!categoryId) return ensureCategoryTx(tx, businessId, KUNLIK_ZAXIRA_KATEGORIYA, "kirim");
  // `isActive` ham tekshiriladi: forma faqat FAOL kategoriyalarni ko'rsatadi,
  // lekin sahifa ochiq turganda kategoriya arxivlanishi mumkin. Bunda jimgina
  // arxivga yozib qo'yish o'rniga aniq xato beramiz.
  const cat = await tx.category.findFirst({
    where: { id: categoryId, businessId, turi: "kirim", isActive: true },
    select: { id: true },
  });
  if (!cat) {
    throw new ForbiddenError("Kategoriya topilmadi, nofaol yoki kirim kategoriyasi emas");
  }
  return cat.id;
}

/**
 * TUSHUM KIRITISH — bugungi (Toshkent) kunga.
 *
 * ═══ NEGA HAQIQIY `Transaction` YOZILADI ═══
 * Ilgari bu forma FAQAT `DailyTransaction` yaratardi. Natijada ikkita
 * kirim daftari bor edi: kunlik hisobotdagi tushum Dashboard "Jami Kirim",
 * oylik hisobot, kategoriya kesimi va kassa qoldig'ida UMUMAN ko'rinmasdi.
 * Ayni paytda Yozuvlardan kiritilgan kirim kunlikka o'zi tushardi
 * (`kunlikSinxron`) — ya'ni bir tomonlama ko'prik. Ikki daftar birinchi
 * uzilishdayoq ajralib ketardi.
 *
 * Endi manba BITTA: tushum `Transaction` (kirim) yozadi va o'sha zahoti
 * unga bog'langan `DailyTransaction` qatori quriladi (`transactionId`).
 * Ikkalasi ham BITTA tranzaksiyada — dublikat ham, yetim yozuv ham
 * bo'lmaydi. Kunlik hisobot shu bilan hosila ko'rinishga aylanadi.
 *
 * Pul kassaga `createTransactionTx` qoidasi bo'yicha tushadi: shaxsiy kassa
 * rejimida kiritgan xodimning kassasiga, aks holda to'lov turiga mos biznes
 * kassasiga. QARZ hech qaysi kassaga bog'lanmaydi — pul hali kelmagan.
 */
export async function addKunlikTushum(
  businessId: string,
  aktor: KunlikAktor,
  data: CreateKunlikTushumInput
) {
  const bugun = kunlikBugun();
  const sana = dateOnlyStringToUTCDate(bugun);

  const { tushum, yozuvId } = await runBusinessTx(businessId, async (tx) => {
    const report = await reportTopYokiYaratTx(tx, businessId, sana);
    if (report.holat !== "OPEN") {
      throw new BadRequestError(
        report.holat === "SUBMITTED"
          ? "Bugungi kassa direktorga topshirilgan — yangi tushum kiritib bo'lmaydi. " +
            "Kerak bo'lsa direktor kunni qayta ochadi."
          : "Bugungi kun yakuni tasdiqlangan — yangi tushum kiritib bo'lmaydi. " +
            "O'zgartirish kerak bo'lsa direktor kunni qayta ochishi mumkin."
      );
    }

    const categoryId = await tushumKategoriyaTx(tx, businessId, data.categoryId);
    const yozuv = await createTransactionTx(tx, aktor.userId, businessId, {
      turi: "kirim",
      categoryId,
      summa: data.summa,
      sana: bugun,
      izoh: data.izoh?.trim() || null,
      tolovTuri: ANIQ_TOLOV_TESKARI[data.tolovTuri],
    });

    const tushum = await tx.dailyTransaction.create({
      data: {
        businessId,
        reportId: report.id,
        summa: data.summa,
        tolovTuri: data.tolovTuri,
        izoh: data.izoh?.trim() || undefined,
        userId: aktor.userId,
        userIsm: aktor.ism,
        transactionId: yozuv.id,
      },
    });
    await jamlashTx(tx, businessId, report.id);
    return { tushum, yozuvId: yozuv.id };
  });

  await logAudit({
    businessId,
    action: "create",
    entity: "dailyTransaction",
    entityId: tushum.id,
    after: {
      summa: data.summa,
      tolovTuri: data.tolovTuri,
      izoh: data.izoh ?? null,
      transactionId: yozuvId,
    },
  });
  return tushum;
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
    if (mavjud.transactionId) {
      // Tushum haqiqiy kirim yozuvi bilan juft yuradi. Uni faqat kunlikda
      // o'zgartirish ikkala tomonni ajratib yuborardi (summa, kassa, kategoriya
      // yozuvda turadi). Shuning uchun manba — `Transaction`: u yerda
      // tahrirlanadi yoki bu yerda o'chirilib qayta kiritiladi.
      throw new BadRequestError(
        "Bu tushum kirim yozuvi bilan bog'langan — uni Yozuvlar bo'limida o'zgartiring " +
          "yoki bu yerda o'chirib, qaytadan kiriting"
      );
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

/**
 * TUSHUMNI O'CHIRISH — yumshoq, jamidan chiqadi, tarixda qoladi.
 *
 * Tushum endi HAQIQIY yozuv (`Transaction`) bilan juft yuradi, shuning uchun
 * ikkala tomon BITTA tranzaksiyada o'chiriladi. Faqat bir tomonini o'chirish
 * (avvalgi xatti-harakat) kunlik va Dashboard raqamlarini ajratib yuborardi.
 *
 * Eski, yozuvsiz tushumlar (migratsiyagacha kiritilganlar) ham shu yo'ldan
 * o'tadi — ularda `transactionId` null bo'lgani uchun ikkinchi qadam
 * o'tkazib yuboriladi.
 */
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
    const endi = new Date();
    await tx.dailyTransaction.updateMany({
      where: { id: mavjud.id, businessId },
      data: { deletedAt: endi },
    });
    if (mavjud.transactionId) {
      await tx.transaction.updateMany({
        where: { id: mavjud.transactionId, businessId, deletedAt: null },
        data: { deletedAt: endi },
      });
    }
    await jamlashTx(tx, businessId, mavjud.reportId);
    return mavjud;
  });

  await logAudit({
    businessId,
    action: "delete",
    entity: "dailyTransaction",
    entityId: id,
    before: {
      summa: eski.summa,
      tolovTuri: eski.tolovTuri,
      izoh: eski.izoh,
      transactionId: eski.transactionId,
    },
  });
  if (eski.transactionId) {
    await logAudit({
      businessId,
      action: "delete",
      entity: "transaction",
      entityId: eski.transactionId,
      before: { summa: eski.summa, turi: "kirim", manba: "kunlik" },
    });
  }
  return { ok: true };
}

/** Kun uchun tayinlangan direktor (tayinlanmagan bo'lsa null). */
async function direktorIdTx(tx: BusinessTx, businessId: string): Promise<string | null> {
  const sozlama = await tx.dailyReportSetting.findFirst({
    where: { businessId },
    select: { direktorId: true },
  });
  return sozlama?.direktorId ?? null;
}

export interface KunlikTopshirishNatija {
  report: {
    id: string;
    jamiSumma: number;
    naqdSumma: number;
    clickSumma: number;
    qarzSumma: number;
    sana: Date;
    sanalganNaqd: number | null;
    kutilganNaqd: number | null;
    kassaFarq: number | null;
    transferId: string | null;
  };
  /** Pul ko'chirilmagan bo'lsa — sababi (UI ogohlantiradi). */
  pulSababi: string | null;
}

/**
 * KUNNI DIREKTORGA TOPSHIRISH — kassa nazoratining birinchi yarmi.
 *
 * ═══ NIMA O'ZGARDI (audit) ═══
 * Ilgari bu amal FAQAT holatni almashtirardi va `sanalganNaqd` ni kunning
 * NAQD KIRIMI (`naqdSumma`) bilan solishtirardi. Ikki xato bor edi:
 *   1. naqd CHIQIM va kun boshidagi qoldiq hisobga olinmasdi — 10 mln kirim,
 *      3 mln naqd chiqim bo'lgan kunda kassada 7 mln bo'ladi, tizim esa
 *      10 mln kutib "3 mln KAMOMAD" degan YOLG'ON ogohlantirish berardi;
 *   2. pul hech qayerga ko'chmasdi — kassirning kassasi kun tasdiqlangandan
 *      keyin ham to'la turaverardi.
 *
 * Endi tizim hisobi kassirning HAQIQIY kassa qoldig'idan olinadi
 * (`topshiruvchiKassaTx` → ledger) va MUZLATILADI (`kutilganNaqd`).
 * Ayni paytda "kutilmoqda" holatidagi `AccountTransfer` yaraladi: pul hali
 * kassirda, lekin topshiriq rasmiylashtirilgan.
 *
 * ═══ KIRIM/CHIQIMGA TA'SIRI: NOL ═══
 * Bu yerda `Transaction` YOZILMAYDI. Jami Kirim ham, Jami Chiqim ham
 * o'zgarmaydi — faqat kassa qoldiqlari ko'chadi.
 *
 * ═══ IKKI MARTA TOPSHIRISHDAN HIMOYA ═══
 * `updateMany` + `holat: "OPEN"` sharti bazada race'ni yopadi: ikkinchi
 * so'rov `count === 0` oladi va xato qaytaradi. Holat almashishi va pul
 * harakati BITTA tranzaksiyada, shuning uchun "holat o'zgardi, o'tkazma
 * yaralmadi" holati bo'lishi mumkin emas.
 */
export async function submitKunlikReport(
  businessId: string,
  aktor: KunlikAktor,
  sanaStr: string,
  sanalganNaqd: number,
  izoh?: string | null
): Promise<KunlikTopshirishNatija> {
  const bugun = kunlikBugun();
  if (sanaStr > bugun) throw new BadRequestError("Kelajak kunni topshirib bo'lmaydi");
  const sana = dateOnlyStringToUTCDate(sanaStr);

  const { report, pulSababi } = await runBusinessTx(businessId, async (tx) => {
    const r = await reportTopYokiYaratTx(tx, businessId, sana);
    if (r.holat !== "OPEN") {
      throw new BadRequestError(
        r.holat === "CONFIRMED"
          ? "Bu kun allaqachon tasdiqlangan"
          : "Bu kun allaqachon direktorga topshirilgan"
      );
    }
    await jamlashTx(tx, businessId, r.id);

    // TIZIM HISOBI — kassirning kassa qoldig'i (naqd kirim − naqd chiqim
    // + o'tkazmalar). Serverda hisoblanadi: frontend yuborgan raqamga
    // ishonilmaydi.
    const manba = await topshiruvchiKassaTx(tx, businessId, aktor.userId);
    const kutilganNaqd = manba.qoldiq;
    const farq = sanalganNaqd - kutilganNaqd;

    // FARQ SABABSIZ YOPILMAYDI — kamomad ham, ortiqcha ham izoh talab qiladi.
    if (farq !== 0 && !izoh?.trim()) {
      throw new BadRequestError(
        farq < 0
          ? `Kassada ${Math.abs(farq).toLocaleString("ru-RU")} so'm KAM chiqdi — sababini yozing`
          : `Kassada ${farq.toLocaleString("ru-RU")} so'm ORTIQCHA chiqdi — sababini yozing`
      );
    }

    const natija = await tx.dailyReport.updateMany({
      where: { id: r.id, businessId, holat: "OPEN" },
      data: {
        holat: "SUBMITTED",
        submittedBy: aktor.userId,
        submittedByIsm: aktor.ism,
        submittedAt: new Date(),
        sanalganNaqd,
        kutilganNaqd,
        kassaFarq: farq,
        izoh: izoh?.trim() || null,
      },
    });
    if (natija.count === 0) {
      throw new BadRequestError("Bu kun allaqachon topshirilgan — sahifani yangilang");
    }

    // PUL HARAKATI. Ledgerda ko'chadigan summa kassir SANAGANidan farq
    // qilishi mumkin: ortiqcha pulning ledgerda manbasi yo'q, shuning uchun
    // u ko'chmaydi (batafsil: kunlikKassa.ts -> kochadiganSumma).
    const pul = await kunTopshiriqYaratTx(
      tx,
      businessId,
      { userId: aktor.userId, ism: aktor.ism },
      await direktorIdTx(tx, businessId),
      sanalganNaqd,
      izoh ?? null,
      kutilganNaqd
    );
    if (pul.transferId) {
      await tx.dailyReport.updateMany({
        where: { id: r.id, businessId },
        data: { transferId: pul.transferId },
      });
    }

    return {
      report: (await tx.dailyReport.findFirst({ where: { id: r.id, businessId } }))!,
      pulSababi: pul.sabab,
    };
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
      kutilganNaqd: report.kutilganNaqd,
      sanalganNaqd,
      farq: report.kassaFarq,
      transferId: report.transferId,
    },
  });

  // Direktorga darhol xabar (best-effort — Telegram ishlamasa jarayon buzilmaydi).
  await kunlikTopshirildiYubor(businessId, report, aktor.ism);

  return { report, pulSababi };
}

/**
 * DIREKTOR QARORI — kun yakunini QABUL QILISH yoki RAD ETISH.
 *
 * ═══ QABUL: PUL KO'CHADI ═══
 * Kun `CONFIRMED` bo'ladi VA topshiriq o'tkazmasi "bajarildi" ga o'tadi.
 * Shu daqiqada kassirning kassa qoldig'i topshirilgan summaga kamayadi
 * (to'liq topshirgan bo'lsa — 0 ga tushadi), direktornikiga esa qo'shiladi.
 *
 * Ikkalasi ham BITTA tranzaksiyada: bir qadam yiqilsa hammasi orqaga
 * qaytadi ("kun tasdiqlandi, pul ko'chmadi" holati bo'lmaydi).
 *
 * ═══ RAD: PUL KASSIRDA QOLADI ═══
 * O'tkazma "rad" bo'ladi (pul umuman ko'chmagan), kun esa `OPEN` ga
 * qaytadi — kassir tuzatib qayta topshiradi.
 *
 * ═══ IKKI MARTA TASDIQLASHDAN HIMOYA ═══
 * Ikki qavat: (1) kun holati `updateMany` + `holat IN (OPEN, SUBMITTED)`;
 * (2) o'tkazma `updateMany` + `holat = "kutilmoqda"`. Ikkinchi bosishda
 * birinchi qavat xato beradi va pul ikkinchi marta KO'CHMAYDI.
 */
export async function qarorKunlikReport(
  businessId: string,
  aktor: KunlikAktor,
  data: KunlikQarorInput
) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);
  if (!ruxsat.tasdiqlaydi) {
    throw new ForbiddenError("Kun yakunini faqat tayinlangan direktor tasdiqlaydi");
  }
  const bugun = kunlikBugun();
  if (data.sana > bugun) throw new BadRequestError("Kelajak kunni tasdiqlab bo'lmaydi");
  const sana = dateOnlyStringToUTCDate(data.sana);

  const { report, oldingiHolat, pulHolati } = await runBusinessTx(businessId, async (tx) => {
    // Tushumsiz kun ham yakunlanishi mumkin (0 so'm bilan) — report ochamiz.
    const r = await reportTopYokiYaratTx(tx, businessId, sana);

    // O'ZINI O'ZI TASDIQLASH TAQIQI: kassir o'z topshirig'ini yopa olmaydi.
    // Boshqaruvchi (OWNER/ADMIN) bundan mustasno — u zanjirning oxiri.
    if (r.submittedBy && r.submittedBy === aktor.userId && !ruxsat.boshqaruvchimi) {
      throw new ForbiddenError("O'z topshirig'ingizni o'zingiz tasdiqlay olmaysiz");
    }

    if (data.amal === "rad") {
      if (r.holat !== "SUBMITTED") {
        throw new BadRequestError("Faqat topshirilgan kunni rad etish mumkin");
      }
      const n = await tx.dailyReport.updateMany({
        where: { id: r.id, businessId, holat: "SUBMITTED" },
        data: {
          holat: "OPEN",
          submittedBy: null,
          submittedByIsm: null,
          submittedAt: null,
          sanalganNaqd: null,
          kutilganNaqd: null,
          kassaFarq: null,
          transferId: null,
          qarorIzoh: data.qarorIzoh?.trim() || null,
        },
      });
      if (n.count === 0) throw new BadRequestError("Kun holati o'zgarib ketdi, sahifani yangilang");

      const pulHolati = r.transferId
        ? await kunTopshiriqOrqagaTx(
            tx,
            businessId,
            { userId: aktor.userId, ism: aktor.ism },
            r.transferId,
            data.qarorIzoh ?? "Direktor rad etdi"
          )
        : "yoq";
      return {
        report: (await tx.dailyReport.findFirst({ where: { id: r.id, businessId } }))!,
        oldingiHolat: r.holat,
        pulHolati,
      };
    }

    // SUBMITTED kunda summalar "muzlagan" — baribir qayta jamlaymiz (himoya).
    await jamlashTx(tx, businessId, r.id);
    const natija = await tx.dailyReport.updateMany({
      where: { id: r.id, businessId, holat: { in: ["OPEN", "SUBMITTED"] } },
      data: {
        holat: "CONFIRMED",
        confirmedBy: aktor.userId,
        confirmedByIsm: aktor.ism,
        confirmedAt: new Date(),
        qarorIzoh: data.qarorIzoh?.trim() || null,
      },
    });
    if (natija.count === 0) {
      throw new BadRequestError("Bu kun allaqachon tasdiqlangan");
    }

    // PUL KO'CHADI — kassirdan direktorga.
    const kochdi = r.transferId
      ? await kunTopshiriqQabulTx(
          tx,
          businessId,
          { userId: aktor.userId, ism: aktor.ism },
          r.transferId,
          data.qarorIzoh ?? null
        )
      : false;

    return {
      report: (await tx.dailyReport.findFirst({ where: { id: r.id, businessId } }))!,
      oldingiHolat: r.holat,
      pulHolati: kochdi ? ("kochdi" as const) : ("yoq" as const),
    };
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "dailyReport",
    entityId: report.id,
    before: { holat: oldingiHolat },
    after: {
      holat: report.holat,
      amal: data.amal,
      sana: data.sana,
      jamiSumma: report.jamiSumma,
      kutilganNaqd: report.kutilganNaqd,
      sanalganNaqd: report.sanalganNaqd,
      farq: report.kassaFarq,
      pul: pulHolati,
      qarorIzoh: data.qarorIzoh ?? null,
    },
  });
  return { report, pulHolati };
}

/**
 * KUN YAKUNINI TASDIQLASH — `qarorKunlikReport` ustidagi yupqa qobiq.
 * Eski chaqiruvchilar (Telegram bot tugmasi, testlar) shu nom bilan yuradi.
 */
export async function confirmKunlikReport(businessId: string, aktor: KunlikAktor, sanaStr: string) {
  const { report } = await qarorKunlikReport(businessId, aktor, { sana: sanaStr, amal: "qabul" });
  return report;
}

/**
 * Yakunlangan (topshirilgan yoki tasdiqlangan) kunni QAYTA OCHISH — tuzatish
 * uchun. Faqat direktor yoki boshqaruvchi.
 *
 * ═══ PUL HAM ORQAGA QAYTADI ═══
 * Kun tasdiqlanganda pul kassirdan direktorga ko'chgan edi. Kun qayta
 * ochilsa u ko'chish HAM bekor qilinishi shart, aks holda kassirning
 * qoldig'i 0 bo'lib qolar, tuzatilgan kunni esa qayta topshirib bo'lmasdi.
 * Ledger append-only: yozuv o'chirilmaydi — teskari STORNO yoziladi
 * (`kunTopshiriqOrqagaTx`), tarix to'liq qoladi.
 */
export async function reopenKunlikReport(businessId: string, aktor: KunlikAktor, sanaStr: string) {
  const ruxsat = await getKunlikRuxsat(businessId, aktor);
  if (!ruxsat.tahrirlaydi) {
    throw new ForbiddenError("Yakunlangan kunni faqat direktor yoki boshqaruvchi qayta ochadi");
  }
  const sana = dateOnlyStringToUTCDate(sanaStr);

  const { report, oldingiHolat, pulHolati } = await runBusinessTx(businessId, async (tx) => {
    const r = await tx.dailyReport.findFirst({ where: { businessId, sana } });
    if (!r) throw new BadRequestError("Bu kun uchun hisobot yo'q");
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
        kutilganNaqd: null,
        kassaFarq: null,
        transferId: null,
      },
    });
    if (natija.count === 0) throw new BadRequestError("Bu kun yakunlanmagan — ochish shart emas");

    const pulHolati = r.transferId
      ? await kunTopshiriqOrqagaTx(
          tx,
          businessId,
          { userId: aktor.userId, ism: aktor.ism },
          r.transferId,
          "Kun yakuni qayta ochildi"
        )
      : "yoq";

    return {
      report: (await tx.dailyReport.findFirst({ where: { id: r.id, businessId } }))!,
      oldingiHolat: r.holat,
      pulHolati,
    };
  });

  await logAudit({
    businessId,
    action: "update",
    entity: "dailyReport",
    entityId: report.id,
    before: { holat: oldingiHolat },
    after: { holat: "OPEN", sana: sanaStr, pul: pulHolati },
  });
  return report;
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
    // Ko'p-bizneslik: ruxsat ro'yxati `UserBusiness` da. Qator bo'lmasa eski
    // `businessId` ustuniga qaraladi (biriktirilmagan xodim — cheklovsiz).
    const biriktirilgan = (
      await prisma.userBusiness.findMany({ where: { userId: user.id }, select: { businessId: true } })
    ).map((b) => b.businessId);
    const cheklov = biriktirilgan.length > 0 ? biriktirilgan : user.businessId ? [user.businessId] : [];
    if (cheklov.length > 0 && !cheklov.includes(businessId)) {
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

/** Tranzaksiyadagi ANIQ to'lov turi -> kunlik to'lov turi. */
const ANIQ_TOLOV_XARITASI: Record<string, KunlikTolovTuri> = {
  naqd: "CASH",
  click: "CLICK",
  qarz: "DEBT",
};

/**
 * Teskari yo'nalish: kunlik to'lov turi -> `Transaction.tolovTuri`.
 * "Tushum kiritish" haqiqiy yozuv yaratganda kerak — ikkala tomon bir xil
 * lug'atdan foydalanishi shart, aks holda kunlik va Yozuvlar ajralib ketardi.
 */
export const ANIQ_TOLOV_TESKARI: Record<KunlikTolovTuri, string> = {
  CASH: "naqd",
  CLICK: "click",
  DEBT: "qarz",
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
  /** "naqd" | "click" | "qarz" — berilgan bo'lsa kassa turidan ustun turadi. */
  tolovTuri?: string | null;
  deletedAt: Date | null;
}

async function tolovTuriniAniqlaTx(
  tx: BusinessTx,
  businessId: string,
  accountId: string | null,
  aniqTuri?: string | null
): Promise<KunlikTolovTuri> {
  // Yozuvda to'lov turi aniq ko'rsatilgan bo'lsa — kassa turiga qaralmaydi.
  if (aniqTuri && ANIQ_TOLOV_XARITASI[aniqTuri]) return ANIQ_TOLOV_XARITASI[aniqTuri];
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
            tolovTuri: await tolovTuriniAniqlaTx(tx, t.businessId, t.accountId, t.tolovTuri),
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
            tolovTuri: await tolovTuriniAniqlaTx(tx, t.businessId, t.accountId, t.tolovTuri),
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
  /** Tizim hisobi (kassa qoldig'i) — topshirish paytida muzlatilgan. */
  kutilganNaqd: number | null;
  /** sanalganNaqd − kutilganNaqd (muzlatilgan). */
  kassaFarq: number | null;
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
    // Farq TIZIM KASSA HISOBIGA qarab o'lchanadi (`kutilganNaqd`), kunning
    // naqd KIRIMIGA emas: naqd chiqim va kun boshidagi qoldiq ham pulga
    // ta'sir qiladi. Eski (migratsiyagacha) kunlarda `kutilganNaqd` null —
    // ular uchun avvalgi taqqoslash saqlanadi.
    const kutilgan = report.kutilganNaqd ?? report.naqdSumma;
    const farq = report.kassaFarq ?? sanalgan - kutilgan;
    const farqQator =
      farq === 0
        ? "✅ Farq yo'q — kassa tizim bilan mos"
        : farq < 0
          ? `⚠️ KAM: ${formatSomLabel(-farq)} yetishmayapti!`
          : `⚠️ Ortiqcha: ${formatSomLabel(farq)}`;

    // Direktorga SOF natija yuboriladi (kirim − chiqim), tushum detali emas.
    // Chiqim — shu kunning Yozuvlardagi chiqimlari. `rawPrisma` — bot
    // xabarnomasi tizim darajasidagi amal (CLAUDE.md).
    const chiqimAgg = await rawPrisma.transaction.aggregate({
      _sum: { summa: true },
      where: { businessId, turi: "chiqim", deletedAt: null, sana: report.sana },
    });
    const chiqim = chiqimAgg._sum.summa ?? 0;
    const sof = report.jamiSumma - chiqim;

    const matn =
      `📤 Kassa topshirildi — tasdiqlash kerak\n\n` +
      `${biznes.nomi} — ${utcDateToDateOnlyString(report.sana).split("-").reverse().join(".")}\n` +
      `Topshirdi: ${topshirganIsm ?? "—"}\n\n` +
      `💵 Kassada bo'lishi kerak: ${formatSomLabel(kutilgan)}\n` +
      `💵 Kassir sanadi/topshirdi: ${formatSomLabel(sanalgan)}\n` +
      `${farqQator}\n\n` +
      `📈 Kirim: ${formatSomLabel(report.jamiSumma)}\n` +
      `📉 Chiqim: ${formatSomLabel(chiqim)}\n` +
      `💰 Sof natija: ${formatSomLabel(sof)}`;

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
