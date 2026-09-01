import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { kirimgaKochirish } from "@/lib/crm/kirim";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import {
  sotuvchiUserIdTop,
  zakazXodimlariniSaqlash,
  zakazXodimlariniTekshir,
} from "@/lib/services/xodimKategoriya";
import {
  avtoSotuvchi,
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

/** Yangi biznes uchun standart bosqichlar. */
export const DEFAULT_STAGES: { nomi: string; turi: "OPEN" | "WON" | "LOST" }[] = [
  { nomi: "Yangi", turi: "OPEN" },
  { nomi: "Aloqa qilindi", turi: "OPEN" },
  { nomi: "Taklif yuborildi", turi: "OPEN" },
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
 * Kanban ma'lumoti: bosqichlar + buyurtmalar (kontakt, kategoriya, sotuvchi
 * va bog'langan kirim bilan).
 *
 * `sotuvchiId` berilsa (25-talab, CRM sotuvchi filtri) saralash BAZADA
 * bo'ladi — `DealEmployee(businessId, employeeId)` indeksi bo'yicha, ya'ni
 * 500 ta zakazni olib kelib brauzerda saralash emas.
 *
 * Sotuvchi nomlari BITTA qo'shimcha so'rovda o'qiladi (N+1 yo'q).
 */
export async function getBoard(businessId: string, sotuvchiId?: string | null) {
  await ensureStages(businessId);
  const [stages, deals] = await Promise.all([
    prisma.stage.findMany({ where: { businessId }, orderBy: { tartib: "asc" } }),
    prisma.deal.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(sotuvchiId
          ? { xodimlar: { some: { businessId, employeeId: sotuvchiId, category: { turi: SOTUVCHI_TURI } } } }
          : {}),
      },
      include: {
        contact: { select: { id: true, ism: true, tel: true } },
        category: { select: { id: true, nomi: true } },
      },
      orderBy: [{ sana: "desc" }, { createdAt: "desc" }],
      take: 500, // sog'lom chegara; arxiv keyingi bosqichda
    }),
  ]);
  const sotuvchilar = await zakazSotuvchilari(businessId, deals.map((d) => d.id));
  return { stages, deals, sotuvchilar };
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
  /** Buyurtma sanasi "YYYY-MM-DD". Berilmasa null (eski xulq). */
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
   * ZAKAZNI OLGAN SOTUVCHI (Employee.id). Berilmasa — foydalanuvchining
   * o'z sotuvchi profili (avto-tanlash).
   */
  sotuvchiId?: string | null;
  /**
   * `crm.sotuvchi` huquqi bor-yo'qligi — HTTP route HAR DOIM ochiq uzatadi.
   * `false` bo'lsa foydalanuvchi zakazni faqat O'Z nomiga yoza oladi
   * (5/27-talab). `undefined` — sessiyasiz ichki chaqiruv (test, skript,
   * bot): u yerda foydalanuvchi tanlovi emas, server mantig'i ishlaydi.
   */
  sotuvchiTanlashHuquqi?: boolean;
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
 * ZAKAZ SOTUVCHISINI ANIQLASH (4/5/6/27-talab) va uni biriktiruvlar
 * ro'yxatiga qo'shish.
 *
 * TANLASH TARTIBI:
 *  1. `sotuvchiId` — yangi, birinchi darajali maydon (forma shuni yuboradi);
 *  2. `xodimlar` ro'yxatidagi SOTUVCHI turidagi kategoriya qatori — ESKI
 *     yo'l, buzilmasin (bot/eski integratsiyalar shu ko'rinishda yuboradi);
 *  3. AVTO-TANLASH: foydalanuvchining o'z sotuvchi profili (4-talab).
 * Hech biri bo'lmasa va biznes sozlamasi majburiy qilsa — aniq xato.
 *
 * Har holatda server xodimni to'liq tekshiradi (biznes, faollik, sotuvchi
 * kategoriyasi a'zoligi) — mijoz yuborgan qiymatga ISHONILMAYDI.
 */
async function sotuvchiniQosh(params: YangiBuyurtma): Promise<ZakazXodimInput[]> {
  const boshqalar = params.xodimlar ?? [];
  const sotuvKategoriyalar = new Set(await sotuvchiKategoriyaIdlari(params.businessId));
  // Sotuvchi endi ALOHIDA maydonda — ro'yxatdagi sotuvchi qatorlari shu
  // yerda ajratib olinadi va oxirida bittasi qaytariladi (ikkita sotuvchi
  // biriktirilib qolmasin).
  const ijrochilar = boshqalar.filter((x) => !sotuvKategoriyalar.has(x.categoryId));
  const royxatdagi = boshqalar.find((x) => sotuvKategoriyalar.has(x.categoryId));

  const ozi = await avtoSotuvchi(params.businessId, params.userId);
  const soralgan = params.sotuvchiId ?? royxatdagi?.employeeId ?? null;

  let tanlangan: { id: string; categoryId: string } | null = null;
  if (soralgan) {
    // HUQUQ: `false` — huquq TEKSHIRILDI va yo'q (route shuni uzatadi);
    // `undefined` — sessiyasiz ichki chaqiruv (test/skript), cheklanmaydi.
    if (params.sotuvchiTanlashHuquqi === false && soralgan !== ozi?.id) {
      throw new ForbiddenError("Boshqa sotuvchini tanlash uchun sizda huquq yo'q");
    }
    const s = await sotuvchiTekshir(params.businessId, soralgan);
    tanlangan = { id: s.id, categoryId: s.categoryId };
  } else if (ozi) {
    const s = await sotuvchiTekshir(params.businessId, ozi.id);
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
  await ensureStages(params.businessId);

  const stage = params.stageId
    ? await prisma.stage.findFirst({ where: { id: params.stageId, businessId: params.businessId } })
    : await prisma.stage.findFirst({
        where: { businessId: params.businessId, turi: "OPEN" },
        orderBy: { tartib: "asc" },
      });
  if (!stage) throw new BadRequestError("Bosqichlar topilmadi");

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
      summa: params.summa ?? 0,
      categoryId,
      stageId: stage.id,
      contactId,
      masulId,
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

  return deal;
}

/**
 * Buyurtmani boshqa holatga (bosqichga) ko'chirish.
 *
 * WON bosqichda `kirimYoz` berilsa kirim SHU YERDA emas, `kirimgaKochirish`
 * orqali yoziladi — dublikatga qarshi himoya (baza cheklovi + atomik
 * tranzaksiya) YAGONA joyda tursin.
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

  const yopilyapti = stage.turi === "WON" || stage.turi === "LOST";

  const updated = await prisma.deal.update({
    where: { id: deal.id },
    data: { stageId: stage.id, yopilganAt: yopilyapti ? new Date() : null },
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

  // Yutildi + kirim yozish so'ralgan bo'lsa — bitta yo'ldan (dublikat himoyasi
  // o'sha yerda). Allaqachon ko'chirilgan bo'lsa jimgina o'tiladi.
  if (stage.turi === "WON" && params.kirimYoz && !deal.transactionId && deal.summa > 0) {
    await kirimgaKochirish({ businessId: params.businessId, dealId: deal.id, userId: params.userId });
    return prisma.deal.findFirst({ where: { id: deal.id, businessId: params.businessId } });
  }

  return updated;
}
