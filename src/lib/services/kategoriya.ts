import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { monthRangeUTC } from "@/lib/date";
import { QARZ_EMAS } from "@/lib/qarzFiltr";
import { kategoriyaNormal, kategoriyaTozala, tizimKategoriyasi } from "@/lib/kategoriyaNom";

/**
 * KATEGORIYA BOSHQARUVI — /app/admin/kategoriyalar sahifasining butun
 * biznes-mantiqi.
 *
 * ASOSIY PRINSIP: TARIX HECH QACHON BUZILMAYDI. Shu bois bu yerda
 * `delete` YO'Q va bo'lmaydi ham — kategoriyani "olib tashlash"ning yagona
 * yo'li `isActive = false`. Tranzaksiya, budjet, qarz va CRM bitimlari
 * kategoriyaga FK bilan bog'langan; o'chirish ularni yo yiqitardi
 * (`onDelete: Restrict`) yo tarixiy hisobotni "Noma'lum" ga aylantirardi.
 *
 * Nomni o'zgartirish esa XAVFSIZ: yozuvlar `categoryId` bilan bog'langan,
 * nom faqat ko'rsatiladigan matn. Shu sababli rename YANGI kategoriya
 * yaratmaydi — mavjud qator yangilanadi va ID o'zgarmaydi.
 */

export interface KategoriyaSatr {
  id: string;
  nomi: string;
  turi: string;
  tartib: number;
  isActive: boolean;
  kgAsosli: boolean;
  createdAt: string;
  /** Servislar avtomatik ishlatadigan kategoriya (lib/kategoriyaNom.ts). */
  tizim: boolean;
  /** Shu biznesdagi o'chirilmagan tranzaksiyalar soni (butun tarix bo'yicha). */
  yozuvSoni: number;
  /** Tanlangan oydagi jami summa — real pul (qarzga yozilgani hisobga olinmaydi). */
  davrSummasi: number;
}

/**
 * Sahifa ro'yxati: kategoriyalar + har biriga yozuv soni va joriy davr summasi.
 *
 * N+1 YO'Q — kategoriya soni qanday bo'lishidan qat'i nazar UCHTA so'rov:
 * kategoriyalar, `groupBy` soni, `groupBy` summasi. Ilgari bu raqamlar
 * umuman ko'rsatilmasdi; ularni qator ichida so'rash 100 kategoriyada
 * 200 ta qo'shimcha so'rov degani bo'lardi.
 */
export async function kategoriyaRoyxati(
  businessId: string,
  oy: string
): Promise<KategoriyaSatr[]> {
  const { from, to } = monthRangeUTC(oy);

  const [categories, sanoq, summalar] = await Promise.all([
    prisma.category.findMany({
      where: { businessId },
      orderBy: [{ turi: "asc" }, { tartib: "asc" }, { nomi: "asc" }],
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { businessId, deletedAt: null },
      _count: { _all: true },
    }),
    // Davr summasi bosh sahifadagi kategoriya taqsimoti bilan BIR XIL
    // qoidadan o'tadi (lib/qarzFiltr.ts), aks holda ikki ekran ikki xil
    // raqam ko'rsatardi.
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { businessId, deletedAt: null, sana: { gte: from, lt: to }, ...QARZ_EMAS },
      _sum: { summa: true },
    }),
  ]);

  const sanoqMap = new Map(sanoq.map((g) => [g.categoryId, g._count._all]));
  const summaMap = new Map(summalar.map((g) => [g.categoryId, g._sum.summa ?? 0]));

  return categories.map((c) => ({
    id: c.id,
    nomi: c.nomi,
    turi: c.turi,
    tartib: c.tartib,
    isActive: c.isActive,
    kgAsosli: c.kgAsosli,
    createdAt: c.createdAt.toISOString(),
    tizim: tizimKategoriyasi(c.nomi, c.turi),
    yozuvSoni: sanoqMap.get(c.id) ?? 0,
    davrSummasi: summaMap.get(c.id) ?? 0,
  }));
}

/**
 * Kategoriya BIROR joyda ishlatilganmi.
 *
 * Turni o'zgartirish shu javobga qarab hal qilinadi, shuning uchun ro'yxat
 * TO'LIQ bo'lishi shart: `Category` ga FK bilan murojaat qiladigan har bir
 * model shu yerda. Sxemaga yangi bog'lanish qo'shilsa, bu ham yangilanadi
 * (`tests/kategoriya-boshqaruv.test.ts` sxemadagi ro'yxat bilan solishtiradi).
 */
export async function kategoriyaIshlatilishi(
  businessId: string,
  categoryId: string
): Promise<number> {
  const [tx, budget, recurring, rule, request, debt, deal] = await Promise.all([
    prisma.transaction.count({ where: { businessId, categoryId } }),
    prisma.budget.count({ where: { businessId, categoryId } }),
    prisma.recurringTransaction.count({ where: { businessId, categoryId } }),
    prisma.approvalRule.count({ where: { businessId, categoryId } }),
    prisma.approvalRequest.count({ where: { businessId, categoryId } }),
    prisma.debt.count({ where: { businessId, categoryId } }),
    prisma.deal.count({ where: { businessId, categoryId } }),
  ]);
  return tx + budget + recurring + rule + request + debt + deal;
}

/** Aktiv biznesga tegishli kategoriyani oladi — begonasi 403 bilan rad etiladi. */
async function kategoriyaniOl(businessId: string, id: string) {
  // TENANT VA BIZNES IZOLYATSIYASI: `prisma` tenantga cheklangan, `businessId`
  // esa bir kompaniyaning ikki biznesi orasidagi chegara. Ikkalasi ham shart —
  // faqat ID bilan kelgan so'rov (IDOR) shu yerda to'xtaydi.
  const cat = await prisma.category.findFirst({ where: { id, businessId } });
  if (!cat) throw new ForbiddenError("Kategoriya topilmadi yoki sizga tegishli emas");
  return cat;
}

/**
 * Registrga befarq dublikat tekshiruvi.
 *
 * Bu tekshiruv FOYDALANUVCHI UCHUN — tushunarli xabar berish uchun. Haqiqiy
 * kafolat bazadagi ifodali unique indeks (migratsiya
 * 20260825130000_kategoriya_registrsiz_unique): ikki so'rov bir vaqtda kelsa
 * ikkalasi ham bu tekshiruvdan o'tib ketadi, lekin bazaga faqat bittasi
 * yoziladi. Ikkinchisining xatosi `dublikatXatosi()` da ushlanadi.
 */
async function dublikatBormi(
  businessId: string,
  turi: string,
  nomi: string,
  bundanTashqari?: string
): Promise<boolean> {
  const norm = kategoriyaNormal(nomi);
  const mavjudlar = await prisma.category.findMany({
    where: { businessId, turi },
    select: { id: true, nomi: true },
  });
  return mavjudlar.some((c) => c.id !== bundanTashqari && kategoriyaNormal(c.nomi) === norm);
}

const TUR_NOMI: Record<string, string> = { kirim: "Kirim", chiqim: "Chiqim" };

function dublikatXabari(turi: string, nomi: string): string {
  return `Bu nomli ${TUR_NOMI[turi] ?? turi} kategoriyasi allaqachon mavjud: "${nomi}".`;
}

/**
 * Bazaning unique cheklovini foydalanuvchi tilidagi xabarga aylantiradi.
 *
 * SQLite "UNIQUE constraint failed" deydi, Prisma esa P2002 kodini beradi —
 * ifodali indeks bo'lgani uchun ikkala ko'rinish ham uchraydi, shuning uchun
 * ikkalasi ham tekshiriladi. Boshqa har qanday xato o'zgarishsiz ko'tariladi:
 * uni "dublikat" deb ko'rsatish haqiqiy nosozlikni yashirib qo'yardi.
 */
function dublikatXatosi(e: unknown): boolean {
  const kod = (e as { code?: string })?.code;
  const xabar = e instanceof Error ? e.message : String(e);
  return kod === "P2002" || /unique constraint/i.test(xabar);
}

export interface YaratInput {
  nomi: string;
  turi: "kirim" | "chiqim";
  kgAsosli?: boolean;
}

export async function kategoriyaYarat(businessId: string, input: YaratInput) {
  const nomi = kategoriyaTozala(input.nomi);
  if (!nomi) throw new BadRequestError("Kategoriya nomi bo'sh bo'lmasligi kerak");

  if (await dublikatBormi(businessId, input.turi, nomi)) {
    throw new BadRequestError(dublikatXabari(input.turi, nomi));
  }

  try {
    return await prisma.category.create({
      data: { nomi, turi: input.turi, kgAsosli: input.kgAsosli ?? false, businessId },
    });
  } catch (e) {
    if (dublikatXatosi(e)) throw new BadRequestError(dublikatXabari(input.turi, nomi));
    throw e;
  }
}

export interface YangilaInput {
  nomi?: string;
  turi?: "kirim" | "chiqim";
  isActive?: boolean;
  kgAsosli?: boolean;
  tartib?: number;
}

export async function kategoriyaYangila(
  businessId: string,
  id: string,
  input: YangilaInput
) {
  const mavjud = await kategoriyaniOl(businessId, id);
  const tizim = tizimKategoriyasi(mavjud.nomi, mavjud.turi);

  const nomi = input.nomi === undefined ? undefined : kategoriyaTozala(input.nomi);
  const nomOzgardi = nomi !== undefined && nomi !== mavjud.nomi;
  const turOzgardi = input.turi !== undefined && input.turi !== mavjud.turi;
  const nofaollashtirish = input.isActive === false && mavjud.isActive;

  // ── TIZIM KATEGORIYASI HIMOYASI (faqat backend — tugmani yashirish himoya emas)
  // POS, qarz, ombor va HR servislari bu kategoriyani NOMI bo'yicha topadi.
  // Nomi o'zgarsa yoki turi almashsa, keyingi avtomatik yozuv eskisini
  // TOPOLMAY qayta yaratardi va bitta oqim ikki kategoriyaga bo'linardi.
  // Nofaol bo'lsa esa kategoriya formalardan yo'qoladi, lekin servis unga
  // yozishda davom etardi — foydalanuvchi "pulim qayerga ketdi" degan holatga
  // tushardi.
  if (tizim && (nomOzgardi || turOzgardi || nofaollashtirish)) {
    throw new ForbiddenError(
      "Bu tizim kategoriyasi: uni o'zgartirib yoki nofaollashtirib bo'lmaydi"
    );
  }

  if (nomi !== undefined && !nomi) {
    throw new BadRequestError("Kategoriya nomi bo'sh bo'lmasligi kerak");
  }

  const yangiTuri = input.turi ?? mavjud.turi;

  // ── TURNI O'ZGARTIRISH: faqat mutlaqo ishlatilmagan kategoriyada.
  // Kirimni chiqimga aylantirish eski yozuvlarning YO'NALISHINI o'zgartirardi:
  // `Transaction.turi` yozuvning o'zida saqlanadi, ya'ni tarixiy summalar
  // joyida qolib, kategoriya ular bilan qarama-qarshi bo'lib qolardi.
  if (turOzgardi) {
    const ishlatilgan = await kategoriyaIshlatilishi(businessId, id);
    if (ishlatilgan > 0) {
      throw new BadRequestError(
        "Bu kategoriya yozuvlarda ishlatilgan, turini o'zgartirib bo'lmaydi"
      );
    }
  }

  if ((nomOzgardi || turOzgardi) && (await dublikatBormi(businessId, yangiTuri, nomi ?? mavjud.nomi, id))) {
    throw new BadRequestError(dublikatXabari(yangiTuri, nomi ?? mavjud.nomi));
  }

  // Kg savdosi bayrog'i faqat kirim kategoriyasida ma'noga ega (chiqimda
  // "sotilgan kg" degan tushuncha yo'q).
  const yangiKg = input.kgAsosli ?? mavjud.kgAsosli;
  if (yangiKg && yangiTuri !== "kirim") {
    throw new BadRequestError("Kg savdosi faqat kirim kategoriyasida bo'ladi");
  }

  try {
    // ID O'ZGARMAYDI — bu yerda `update`, hech qachon "yangisini yaratib
    // eskisini o'chirish" emas. Tranzaksiyalar, budjetlar, qarzlar va CRM
    // bitimlari `categoryId` bilan bog'langan holicha qoladi.
    return await prisma.category.update({
      where: { id },
      data: {
        ...(nomi !== undefined ? { nomi } : {}),
        ...(input.turi !== undefined ? { turi: input.turi } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.kgAsosli !== undefined ? { kgAsosli: input.kgAsosli } : {}),
        ...(input.tartib !== undefined ? { tartib: input.tartib } : {}),
      },
    });
  } catch (e) {
    if (dublikatXatosi(e)) {
      throw new BadRequestError(dublikatXabari(yangiTuri, nomi ?? mavjud.nomi));
    }
    throw e;
  }
}
