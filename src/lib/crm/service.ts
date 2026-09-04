import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { dateOnlyStringToUTCDate, todayTashkentDateOnlyString, utcDateToDateOnlyString } from "@/lib/date";
import { kirimgaKochirish } from "@/lib/crm/kirim";
// Aylanma import (yakunlash.ts ham shu fayldan `pipelineBosqichlari` ni oladi)
// xavfsiz: ikkala tomon ham faqat CHAQIRUV vaqtida murojaat qiladi.
import { zakazniYakunlash } from "@/lib/crm/yakunlash";
import {
  yopiqHolat,
  zakazUstuni,
  type Ustun,
  type ZakazHolat,
} from "@/lib/crm/pipeline";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import {
  sotuvchiUserIdTop,
  zakazXodimlariniSaqlash,
  zakazXodimlariniTekshir,
} from "@/lib/services/zakazJamoasi";
import {
  sotuvchiKategoriyaIdlari,
  sotuvchiMajburiymi,
  sotuvchiTekshir,
  zakazSotuvchilari,
  SOTUVCHI_TURI,
} from "@/lib/services/zakazSotuvchi";
import type { ZakazXodimInput } from "@/lib/validation/xodimKategoriya";

/**
 * CRM xizmat qatlami. Barcha funksiyalar tenant kontekstida chaqiriladi —
 * prisma avtomatik izolyatsiyalangan.
 *
 * CRM — KUNLIK BUYURTMALAR doskasi. Buyurtma kategoriyasi Kirim modulidagi
 * AYNAN o'sha `Category` jadvalidan olinadi (alohida CRM kategoriya tizimi
 * yo'q), pul esa faqat "Kirimga o'tkazish" bosilganda yoziladi
 * (`lib/crm/kirim.ts`).
 */

/**
 * ZAKAZ OQIMI BOSQICHLARI.
 *
 * Doskaning ustunlari BOSQICHDAN emas, `Deal.holat` + `Deal.sana` dan
 * hisoblanadi (`lib/crm/pipeline.ts`). Bosqich esa saqlanib qoldi va
 * holatning KO'ZGUSI sifatida sinxron yuritiladi, chunki dashboard, AI
 * analitikasi va xodim reytingi hali `Stage.turi` (OPEN/WON/LOST) ni
 * o'qiydi — ular hech qanday o'zgarishsiz ishlashda davom etadi.
 */
export const JARAYON_BOSQICHI = "Jarayonda";

export const DEFAULT_STAGES: { nomi: string; turi: "OPEN" | "WON" | "LOST" }[] = [
  { nomi: "Kutilayotgan zakazlar", turi: "OPEN" },
  { nomi: JARAYON_BOSQICHI, turi: "OPEN" },
  { nomi: "Yutildi", turi: "WON" },
  { nomi: "Yo'qotildi", turi: "LOST" },
];

/** Biznesda bosqichlar bo'lmasa standart to'plamni yaratadi (idempotent). */
export async function ensureStages(businessId: string) {
  const bor = await prisma.stage.count({ where: { businessId } });
  if (bor > 0) return;
  await prisma.stage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({ businessId, nomi: s.nomi, turi: s.turi, tartib: i })),
  });
}

/**
 * HOLAT → BOSQICH XARITASI (idempotent).
 *
 * Eski bizneslarda bosqichlar boshqacha nomlangan ("Yangi", "Aloqa
 * qilindi", ...) — ular O'CHIRILMAYDI: eski zakazlar hali ularga
 * bog'langan va tarix buzilmasligi kerak. Yetishmagani (masalan
 * "Jarayonda") shu yerda qo'shiladi.
 */
export async function pipelineBosqichlari(businessId: string): Promise<Record<ZakazHolat, string>> {
  await ensureStages(businessId);
  const stages = await prisma.stage.findMany({
    where: { businessId },
    orderBy: { tartib: "asc" },
    select: { id: true, nomi: true, turi: true, tartib: true },
  });

  const oxirgiTartib = stages.reduce((m, s) => Math.max(m, s.tartib), -1);
  let keyingiTartib = oxirgiTartib + 1;
  const yarat = async (nomi: string, turi: "OPEN" | "WON" | "LOST") => {
    const s = await prisma.stage.create({
      data: { businessId, nomi, turi, tartib: keyingiTartib++ },
      select: { id: true },
    });
    return s.id;
  };

  // KUTILMOQDA — birinchi OPEN bosqich (eski bizneslarda "Yangi").
  const kutilmoqda =
    stages.find((s) => s.turi === "OPEN")?.id ?? (await yarat("Kutilayotgan zakazlar", "OPEN"));
  // JARAYONDA — nomi bo'yicha, chunki `Stage.turi` da "jarayon" turi yo'q
  // (uni qo'shish barcha eski o'quvchilarni sindirardi).
  const jarayonda =
    stages.find((s) => s.turi === "OPEN" && s.nomi === JARAYON_BOSQICHI)?.id ??
    (await yarat(JARAYON_BOSQICHI, "OPEN"));
  const yutildi = stages.find((s) => s.turi === "WON")?.id ?? (await yarat("Yutildi", "WON"));
  const yoqotildi = stages.find((s) => s.turi === "LOST")?.id ?? (await yarat("Yo'qotildi", "LOST"));

  return { KUTILMOQDA: kutilmoqda, JARAYONDA: jarayonda, YUTILDI: yutildi, YOQOTILDI: yoqotildi };
}

/**
 * BOSQICH → HOLAT. Eski yo'l (bosqich berish/sudrash) hali ishlaydi,
 * shuning uchun teskari yo'nalish ham YAGONA joyda yoziladi: `holat`
 * haqiqat manbai bo'lgani uchun bosqich berilganda u ham to'g'ri
 * to'ldirilishi shart, aks holda doska va statistika bir-biriga zid
 * bo'lib qolardi.
 */
export function bosqichdanHolat(stage: { turi: string; nomi: string }): ZakazHolat {
  if (stage.turi === "WON") return "YUTILDI";
  if (stage.turi === "LOST") return "YOQOTILDI";
  if (stage.nomi === JARAYON_BOSQICHI) return "JARAYONDA";
  return "KUTILMOQDA";
}

/**
 * DOSKA FILTRI (12-talab). Sana filtri ZAKAZ SANASI bo'yicha kesadi
 * (`sana` bo'lmagan eski zakazlarda `createdAt`), sotuvchi — mas'ul xodim,
 * kategoriya — Kirim kategoriyasi.
 */
export interface DoskaFiltr {
  /** "YYYY-MM-DD" (inclusive). */
  from?: string | null;
  /** "YYYY-MM-DD" (inclusive). */
  to?: string | null;
  masulId?: string | null;
  categoryId?: string | null;
  /**
   * SOTUVCHI FILTRI (Employee.id). Saralash BAZADA bo'ladi —
   * `DealEmployee(businessId, employeeId)` indeksi bo'yicha, ya'ni 500 ta
   * zakazni olib kelib brauzerda saralash emas.
   */
  sotuvchiId?: string | null;
  /** Arxiv (yo'qotilgan) zakazlar ham qaytsinmi. */
  yoqotilgan?: boolean;
}

const KUN_MS = 24 * 60 * 60 * 1000;

/** Sana sharti: zakaz sanasi (bo'lmasa `createdAt`) oraliq ichida. */
function sanaShart(from?: string | null, to?: string | null) {
  if (!from && !to) return {};
  const gte = from ? dateOnlyStringToUTCDate(from) : undefined;
  const lt = to ? new Date(dateOnlyStringToUTCDate(to).getTime() + KUN_MS) : undefined;
  const oraliq = { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
  return { OR: [{ sana: oraliq }, { sana: null, createdAt: oraliq }] };
}

/**
 * Kanban ma'lumoti: bosqichlar + zakazlar (kontakt, kategoriya, kirim va
 * qarz bog'lanishi bilan).
 *
 * USTUN BU YERDA TANLANMAYDI: har zakaz `holat` + `sana` bilan qaytadi,
 * ustunni `lib/crm/pipeline.ts` dagi `zakazUstuni` hisoblaydi — server ham,
 * brauzer ham ayni qoidadan foydalanadi.
 *
 * Zakaz SOTUVCHILARI bitta qo'shimcha so'rovda o'qiladi (N+1 yo'q) va
 * `sotuvchilar` xaritasida qaytadi.
 */
export async function getBoard(businessId: string, filtr: DoskaFiltr = {}) {
  await ensureStages(businessId);
  const [stages, deals] = await Promise.all([
    prisma.stage.findMany({ where: { businessId }, orderBy: { tartib: "asc" } }),
    prisma.deal.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(filtr.yoqotilgan ? {} : { holat: { not: "YOQOTILDI" } }),
        ...(filtr.masulId ? { masulId: filtr.masulId } : {}),
        ...(filtr.categoryId ? { categoryId: filtr.categoryId } : {}),
        // SOTUVCHI FILTRI — biriktiruv jadvali orqali, bazada.
        ...(filtr.sotuvchiId
          ? {
              xodimlar: {
                some: { businessId, employeeId: filtr.sotuvchiId, category: { turi: SOTUVCHI_TURI } },
              },
            }
          : {}),
        ...sanaShart(filtr.from, filtr.to),
      },
      include: {
        contact: { select: { id: true, ism: true, tel: true } },
        category: { select: { id: true, nomi: true } },
        // Kirim/qarz summasi YOZUVNING O'ZIDAN o'qiladi: o'chirilgan yoki
        // tahrirlangan tranzaksiya doskada eski raqam bo'lib qolmasin.
        transaction: { select: { id: true, summa: true, deletedAt: true } },
        debt: { select: { id: true, jamiSumma: true, tolangan: true, status: true } },
      },
      // USTUN ICHIDAGI TARTIB bu yerda EMAS: uni `zakazlarniTartibla`
      // (`lib/crm/pipeline.ts`) hisoblaydi — "Yutildi"ga endigina o'tgan
      // zakaz ustun tepasida turadi. Bu yerdagi tartib faqat 500 lik
      // oynani barqaror qiladi.
      orderBy: [{ sana: "asc" }, { createdAt: "desc" }],
      take: 500, // sog'lom chegara; arxiv alohida filtr bilan ochiladi
    }),
  ]);
  const sotuvchilar = await zakazSotuvchilari(businessId, deals.map((d) => d.id));
  return { stages, deals, sotuvchilar };
}

/**
 * ZAKAZNI BOSHQA HOLATGA O'TKAZISH — PULSIZ o'tishlar uchun
 * (KUTILMOQDA ↔ JARAYONDA ↔ YOQOTILDI).
 *
 * YUTILDI bu yerda EMAS: u moliyaviy yakun (kirim + qarzdorlik) va
 * `lib/crm/yakunlash.ts` da atomik bajariladi. Shu funksiya YUTILDI
 * so'ralsa ataylab rad etadi — pul yozadigan yo'l bitta bo'lsin.
 */
export async function holatniOzgartirish(params: {
  businessId: string;
  dealId: string;
  holat: Exclude<ZakazHolat, "YUTILDI">;
  userId: string;
}) {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, contactId: true, holat: true, transactionId: true, debtId: true },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");

  // YUTILGAN zakaz ORQAGA qaytmaydi: kirim/qarz allaqachon yozilgan bo'lsa
  // uni "jarayonda" ga surish moliyani CRM bilan zid holatga tushirardi.
  if (deal.holat === "YUTILDI" && (deal.transactionId || deal.debtId)) {
    throw new BadRequestError(
      "Yutilgan va moliyaga o'tgan zakaz holati o'zgartirilmaydi — avval kirim/qarz yozuvini tuzating"
    );
  }

  const bosqichlar = await pipelineBosqichlari(params.businessId);
  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: {
      holat: params.holat,
      stageId: bosqichlar[params.holat],
      yopilganAt: yopiqHolat(params.holat) ? new Date() : null,
      // Doska ustunidagi tartib shu vaqtdan (eng yangi o'tish — eng tepada).
      holatAt: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId: deal.contactId,
      turi: "tizim",
      matn: `Holat: ${params.holat}`,
      userId: params.userId,
    },
  });

  return updated;
}

/**
 * ZAKAZNI BUGUNGA KO'CHIRISH (10-talab, "Bugungi zakazga o'tkazish").
 *
 * Holat o'zgarmaydi — SANA bugunga o'rnatiladi, ustun esa sanadan
 * hisoblanadi. Ya'ni "bugungi" bayrog'i degan ikkinchi haqiqat manbai
 * paydo bo'lmaydi.
 */
export async function bugungaKochirish(params: {
  businessId: string;
  dealId: string;
  userId: string;
  bugun?: string;
}) {
  const bugun = params.bugun ?? todayTashkentDateOnlyString();
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, contactId: true, holat: true },
  });
  if (!deal) throw new ForbiddenError("Zakaz topilmadi");
  if (deal.holat !== "KUTILMOQDA") {
    throw new BadRequestError("Faqat kutilayotgan zakaz bugungiga ko'chiriladi");
  }

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: { sana: dateOnlyStringToUTCDate(bugun) },
  });
  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId: deal.contactId,
      turi: "tizim",
      matn: `Zakaz sanasi bugunga ko'chirildi: ${bugun}`,
      userId: params.userId,
    },
  });
  return updated;
}

/** Zakazning joriy doska ustuni (server tomonda kerak bo'lganda). */
export function dealUstuni(
  deal: { holat: string; sana: Date | null },
  bugun = todayTashkentDateOnlyString()
): Ustun {
  return zakazUstuni(deal.holat, deal.sana ? utcDateToDateOnlyString(deal.sana) : null, bugun);
}

export interface YangiBuyurtma {
  businessId: string;
  /** Xizmat/buyurtma nomi (masalan "Onajon Dekor"). */
  nomi: string;
  summa?: number;
  /** KIRIM kategoriyasi — Kirim modulidagi kategoriya id'si. */
  categoryId?: string | null;
  contactId?: string | null;
  kontaktIsm?: string | null; // berilsa yangi kontakt yaratiladi
  kontaktTel?: string | null;
  /**
   * ZAKAZ SANASI "YYYY-MM-DD" — xizmat qaysi kunga belgilangan.
   * `createdAt` (CRM'ga qachon kiritildi) bilan ARALASHTIRILMAYDI: doskadagi
   * o'rin va UI'dagi asosiy sana aynan shu maydon.
   * Yangi zakazda majburiy (validatsiya qatlami majburlaydi); null — eski
   * yozuvlar bilan moslik uchun.
   */
  sana?: string | null;
  muddat?: string | null; // "YYYY-MM-DD"
  manba?: string | null;
  izoh?: string | null;
  /** Mas'ul xodim. Berilmasa — buyurtmani kiritgan foydalanuvchi. */
  masulId?: string | null;
  /** Boshlang'ich holat (bosqich). Berilmasa — birinchi OPEN bosqich. */
  stageId?: string | null;
  /** Zakazdagi xodimlar (kategoriya kesimida). Berilmasa — biriktiruvsiz. */
  xodimlar?: ZakazXodimInput[];
  /**
   * TO'LANGAN summa (so'm). To'lov holati shundan hisoblanadi:
   * `tolangan >= summa` — to'liq, `0 < tolangan < summa` — qisman, 0 — qarzga.
   */
  tolangan?: number;
  /** Pul kanali: "naqd" | "click" | "qarz". */
  tolovTuri?: string | null;
  /**
   * ZAKAZNI OLGAN SOTUVCHI (Employee.id) — FAQAT QO'LDA tanlanadi.
   * Berilmasa sotuvchi biriktirilmaydi (biznes sozlamasi majburiy qilsa
   * xato qaytadi). AVTO-TANLASH YO'Q: bitta kompyuterda bitta hisob ochiq
   * turgani "kirgan foydalanuvchi = sotuvchi" degani emas.
   */
  sotuvchiId?: string | null;
  /** Zakazni CRM'ga kiritgan foydalanuvchi (`createdBy`) — sotuvchidan alohida. */
  userId: string;
}

/** Kategoriya shu biznesning KIRIM kategoriyasi ekanini tekshiradi. */
async function kirimKategoriyasi(businessId: string, categoryId: string): Promise<string> {
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, businessId },
    select: { id: true, turi: true },
  });
  if (!cat) throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
  if (cat.turi !== "kirim") throw new BadRequestError("Buyurtma kategoriyasi kirim turida bo'lishi kerak");
  return cat.id;
}

/**
 * MAS'UL XODIM — shu biznesda ishlaydigan faol foydalanuvchi bo'lishi shart.
 *
 * Tenant filtri o'zi yetarli emas: bir kompaniyada bir necha biznes bo'lsa,
 * A biznesining sotuvchisi buyurtmani B biznesining xodimiga yozib
 * qo'yardi. `biznesXodimlariWhere` uchala holatni qamraydi — biriktirilgan,
 * eski usulda biriktirilgan va umuman biriktirilmagan (direktor).
 */
export async function biznesXodimi(businessId: string, userId: string): Promise<string> {
  const masul = await prisma.user.findFirst({
    where: { id: userId, isActive: true, ...biznesXodimlariWhere(businessId) },
    select: { id: true },
  });
  if (!masul) throw new ForbiddenError("Mas'ul xodim bu biznesda ishlamaydi");
  return masul.id;
}

/** Kontakt: mavjudini qayta ishlatadi (telefon bo'yicha), bo'lmasa yaratadi. */
async function kontaktTop(params: YangiBuyurtma): Promise<string | null> {
  if (params.contactId) {
    const bor = await prisma.contact.findFirst({
      where: { id: params.contactId, businessId: params.businessId, deletedAt: null },
      select: { id: true },
    });
    if (!bor) throw new ForbiddenError("Mijoz bu biznesga tegishli emas");
    return bor.id;
  }
  if (!params.kontaktIsm?.trim()) return null;

  // Telefon bo'yicha mavjud kontaktni qayta ishlatamiz (dublikat oldini olish).
  const tel = params.kontaktTel?.trim() || null;
  const existing = tel
    ? await prisma.contact.findFirst({ where: { businessId: params.businessId, tel, deletedAt: null } })
    : null;
  if (existing) return existing.id;

  const contact = await prisma.contact.create({
    data: {
      businessId: params.businessId,
      ism: params.kontaktIsm.trim(),
      tel,
      createdBy: params.userId,
    },
  });
  return contact.id;
}

/**
 * ZAKAZ SOTUVCHISINI ANIQLASH va uni biriktiruvlar ro'yxatiga qo'shish.
 *
 * TANLASH TARTIBI:
 *  1. `sotuvchiId` — birinchi darajali maydon (forma shuni yuboradi);
 *  2. `xodimlar` ro'yxatidagi SOTUVCHI turidagi kategoriya qatori — ESKI
 *     yo'l, buzilmasin (bot/eski integratsiyalar shu ko'rinishda yuboradi).
 * Hech biri bo'lmasa sotuvchi TANLANMAGAN bo'lib qoladi; biznes sozlamasi
 * majburiy qilsa — aniq xato.
 *
 * AVTO-TANLASH ATAYLAB YO'Q. Umumiy kompyuterdan ishlaydigan bo'limda
 * (Disney Navoiy sotuv bo'limi) tizimga kirgan hisob zakazni KIM SOTGANINI
 * bildirmaydi: bitta hisobdan hamma kiritadi. Kirgan foydalanuvchidan
 * sotuvchini taxmin qilish butun sotuv statistikasini bir odamga yig'ib
 * qo'yardi. Kirgan odam `Deal.createdBy` da alohida saqlanadi.
 *
 * HUQUQ TEKSHIRUVI HAM YO'Q (ayni sabab): CRM'ga kira olgan har bir xodim
 * biznesning HAR QAYSI faol sotuvchisini tanlay oladi — "boshqa sotuvchini
 * tanlash" imtiyoz emas, kundalik amal. Cheklov RO'YXATNING O'ZIDA qoladi:
 * server har chaqiruvda xodim shu biznesniki, faol va sotuvchi kategoriyasi
 * a'zosi ekanini tekshiradi (`sotuvchiTekshir`), ya'ni mijoz yuborgan
 * qiymatga baribir ISHONILMAYDI.
 */
async function sotuvchiniQosh(params: YangiBuyurtma): Promise<ZakazXodimInput[]> {
  const boshqalar = params.xodimlar ?? [];
  const sotuvKategoriyalar = new Set(await sotuvchiKategoriyaIdlari(params.businessId));
  // Sotuvchi endi ALOHIDA maydonda — ro'yxatdagi sotuvchi qatorlari shu
  // yerda ajratib olinadi va oxirida bittasi qaytariladi (ikkita sotuvchi
  // biriktirilib qolmasin).
  const ijrochilar = boshqalar.filter((x) => !sotuvKategoriyalar.has(x.categoryId));
  const royxatdagi = boshqalar.find((x) => sotuvKategoriyalar.has(x.categoryId));

  const soralgan = params.sotuvchiId ?? royxatdagi?.employeeId ?? null;

  let tanlangan: { id: string; categoryId: string } | null = null;
  if (soralgan) {
    const s = await sotuvchiTekshir(params.businessId, soralgan);
    tanlangan = { id: s.id, categoryId: s.categoryId };
  }

  if (!tanlangan && (await sotuvchiMajburiymi(params.businessId))) {
    throw new BadRequestError("Buyurtmani olgan sotuvchini tanlang");
  }

  return tanlangan
    ? [...ijrochilar, { categoryId: tanlangan.categoryId, employeeId: tanlangan.id }]
    : ijrochilar;
}

/**
 * Yangi buyurtma: kerak bo'lsa mijoz ham yaratiladi.
 * Holat berilmasa birinchi OPEN bosqichga tushadi.
 */
export async function createDeal(params: YangiBuyurtma) {
  const bosqichlar = await pipelineBosqichlari(params.businessId);

  // YANGI ZAKAZ HAR DOIM "KUTILAYOTGAN" da tug'iladi (1-talab). Sanasi bugun
  // bo'lsa u DARHOL "Bugungi zakazlar" ustunida ko'rinadi — chunki ustun
  // sanadan hisoblanadi, hech qanday qo'shimcha yozuvsiz.
  //
  // ESKI YO'L: `stageId` ataylab berilgan bo'lsa (masalan import yoki
  // tarixiy yozuv) holat O'SHA bosqichdan chiqadi — `holat` va bosqich
  // hech qachon bir-biriga zid bo'lib qolmasin.
  const berilganStage = params.stageId
    ? await prisma.stage.findFirst({ where: { id: params.stageId, businessId: params.businessId } })
    : null;
  if (params.stageId && !berilganStage) throw new BadRequestError("Bosqich topilmadi");
  const stageId = berilganStage?.id ?? bosqichlar.KUTILMOQDA;
  const holat: ZakazHolat = berilganStage ? bosqichdanHolat(berilganStage) : "KUTILMOQDA";

  const summa = params.summa ?? 0;
  const tolangan = Math.max(0, Math.min(params.tolangan ?? 0, summa));
  if ((params.tolangan ?? 0) > summa) {
    throw new BadRequestError("To'langan summa zakaz narxidan ko'p bo'lmasligi kerak");
  }

  const categoryId = params.categoryId ? await kirimKategoriyasi(params.businessId, params.categoryId) : null;

  // SOTUVCHI — mijoz yaratilishidan OLDIN hal qilinadi: xato bo'lsa yon
  // ta'sir (yangi kontakt) qolib ketmasin.
  const xodimlar = await sotuvchiniQosh(params);

  const contactId = await kontaktTop(params);

  // Mas'ul xodim shu BIZNESning faol foydalanuvchisi bo'lishi shart.
  let masulId = params.userId;
  if (params.masulId && params.masulId !== params.userId) {
    masulId = await biznesXodimi(params.businessId, params.masulId);
  }
  // SOTUVCHI biriktiruvi mas'ulni YETAKLAYDI: "sotuvchi" turidagi kategoriyaga
  // tayinlangan, tizim hisobi bog'langan xodim — zakaz o'shaniki. Shunda
  // CRM→Kirim `sotuvchiId` (mavjud xodim statistikasi) ham ayni sotuvchiga
  // yoziladi — ikki hisob bitta haqiqat manbaida qoladi.
  if (xodimlar.length) {
    // Tekshiruv YARATISHDAN OLDIN — xato ro'yxat bilan buyurtma umuman ochilmasin.
    await zakazXodimlariniTekshir(params.businessId, xodimlar);
    const sotuvchiUserId = await sotuvchiUserIdTop(params.businessId, xodimlar);
    if (sotuvchiUserId) {
      const sotuvchi = await prisma.user.findFirst({
        where: { id: sotuvchiUserId, isActive: true, ...biznesXodimlariWhere(params.businessId) },
        select: { id: true },
      });
      if (sotuvchi) masulId = sotuvchi.id;
    }
  }

  const deal = await prisma.deal.create({
    data: {
      businessId: params.businessId,
      nomi: params.nomi.trim(),
      summa,
      tolangan,
      tolovTuri: params.tolovTuri ?? null,
      holat,
      yopilganAt: yopiqHolat(holat) ? new Date() : null,
      // Yaratilish — zakazning BIRINCHI holati, shu bois tartib vaqti ham shu.
      holatAt: new Date(),
      categoryId,
      stageId,
      contactId,
      masulId,
      // KIRITGAN ODAM — sotuvchidan ALOHIDA maydon. `masulId` bunga javob
      // bermaydi: u sotuvchining tizim hisobiga sinxronlanadi (pastda).
      createdBy: params.userId,
      manba: params.manba ?? "qolda",
      sana: params.sana ? dateOnlyStringToUTCDate(params.sana) : null,
      muddat: params.muddat ? dateOnlyStringToUTCDate(params.muddat) : null,
      izoh: params.izoh?.trim() || null,
    },
    include: {
      contact: { select: { id: true, ism: true, tel: true } },
      category: { select: { id: true, nomi: true } },
    },
  });

  // Zakaz xodimlari — kategoriya/a'zolik tekshiruvi bilan (xizmat qatlami).
  if (xodimlar.length) {
    await zakazXodimlariniSaqlash(params.businessId, deal.id, xodimlar);
  }

  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId,
      turi: "tizim",
      matn: "Buyurtma yaratildi",
      userId: params.userId,
    },
  });

  // To'g'ridan-to'g'ri YUTILDI bosqichida yaratilgan (eski yo'l: import,
  // tarixiy yozuv) zakazning moliyasi ham DARHOL yoziladi — "yutilgan, lekin
  // kirimi yo'q" holat paydo bo'lmasin. To'lov tanlanmagan bo'lsa hech
  // narsa yozilmaydi (yakunlash.ts qoidasi).
  if (holat === "YUTILDI") {
    await zakazniYakunlash({ businessId: params.businessId, dealId: deal.id, userId: params.userId });
    const yangilangan = await prisma.deal.findFirst({
      where: { id: deal.id, businessId: params.businessId },
      include: {
        contact: { select: { id: true, ism: true, tel: true } },
        category: { select: { id: true, nomi: true } },
      },
    });
    return yangilangan ?? deal;
  }

  return deal;
}

/**
 * Buyurtmani boshqa holatga (bosqichga) ko'chirish — ESKI YO'L (bosqichga
 * sudrash / `stageId` bilan PATCH).
 *
 * WON bosqich = YUTILDI: moliya (to'langan qism kirim, qolgani qarz) SHU
 * YERDA emas, `zakazniYakunlash` orqali — atomik va idempotent, dublikatga
 * qarshi himoya YAGONA joyda tursin. Shunda "yutilgan, lekin kirimi yo'q"
 * zakaz bu yo'ldan ham paydo bo'lmaydi.
 *
 * `kirimYoz` (eski xulq): to'lovi TANLANMAGAN zakazda butun summa kirimga
 * (`kirimgaKochirish`). To'lovi belgilangan zakazda u ahamiyatsiz — moliya
 * allaqachon tanlovga ko'ra yozilgan.
 */
export async function moveDeal(params: {
  businessId: string;
  dealId: string;
  stageId: string;
  kirimYoz?: boolean;
  userId: string;
}) {
  const deal = await prisma.deal.findFirst({
    where: { id: params.dealId, businessId: params.businessId, deletedAt: null },
    select: { id: true, contactId: true, transactionId: true, summa: true },
  });
  if (!deal) throw new ForbiddenError("Buyurtma topilmadi");

  const stage = await prisma.stage.findFirst({ where: { id: params.stageId, businessId: params.businessId } });
  if (!stage) throw new ForbiddenError("Bosqich topilmadi");

  // BOSQICH → HOLAT SINXRONI. `Deal.holat` haqiqat manbai, bosqich uning
  // ko'zgusi; eski yo'l (bosqichga sudrash) hali ishlaydi, shuning uchun
  // bu yerda teskari yo'nalish ham yuritiladi.
  const holat = bosqichdanHolat(stage);
  const yopilyapti = yopiqHolat(holat);

  if (holat === "YUTILDI") {
    // YUTILDI → holat, kirim va qarz BITTA tranzaksiyada (yakunlash.ts).
    // Takror chaqiruv yangi yozuv yaratmaydi.
    await zakazniYakunlash({ businessId: params.businessId, dealId: deal.id, userId: params.userId });
    const hozir = await prisma.deal.findFirst({
      where: { id: deal.id, businessId: params.businessId },
      select: { transactionId: true, debtId: true, summa: true },
    });
    if (params.kirimYoz && hozir && !hozir.transactionId && !hozir.debtId && hozir.summa > 0) {
      await kirimgaKochirish({ businessId: params.businessId, dealId: deal.id, userId: params.userId });
    }
    return prisma.deal.findFirst({ where: { id: deal.id, businessId: params.businessId } });
  }

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: { stageId: stage.id, holat, yopilganAt: yopilyapti ? new Date() : null, holatAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      businessId: params.businessId,
      dealId: deal.id,
      contactId: deal.contactId,
      turi: "tizim",
      matn: `"${stage.nomi}" holatiga o'tkazildi`,
      userId: params.userId,
    },
  });

  return updated;
}
