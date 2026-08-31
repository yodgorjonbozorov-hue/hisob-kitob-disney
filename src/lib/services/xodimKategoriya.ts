import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import type { KategoriyaCreateInput, KategoriyaPatchInput, ZakazXodimInput } from "@/lib/validation/xodimKategoriya";

/**
 * XODIM KATEGORIYALARI (yo'nalishlar) va zakaz-xodim biriktiruvi xizmati.
 *
 * Kategoriya biznes darajasida sozlanadi (Sotuvchi, Diktor, Shofer, ...) —
 * qattiq kodlangan ro'yxat YO'Q. O'chirish yo'q, faqat `aktiv=false`:
 * tarixiy zakaz biriktiruvlari (DealEmployee) o'z joyida qoladi.
 *
 * MOLIYAVIY QATLAM EMAS: bu yerda pul yozilmaydi — CRM→Kirim oqimi
 * (`lib/crm/kirim.ts`) tegilmagan. Barcha funksiyalar tenant kontekstida
 * chaqiriladi — `prisma` avtomatik izolyatsiyalangan.
 */

export interface KategoriyaAzoDTO {
  id: string;
  ism: string;
  rasmUrl: string | null;
  isActive: boolean;
  userId: string | null;
}

export interface KategoriyaDTO {
  id: string;
  nomi: string;
  turi: string;
  aktiv: boolean;
  tartib: number;
  azolar: KategoriyaAzoDTO[];
}

/** Barcha kategoriyalar (boshqaruv sahifasi) — a'zolari bilan. */
export async function listKategoriyalar(businessId: string): Promise<KategoriyaDTO[]> {
  const rows = await prisma.employeeCategory.findMany({
    where: { businessId },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
    include: {
      azolar: {
        include: {
          employee: { select: { id: true, ism: true, rasmUrl: true, isActive: true, userId: true, deletedAt: true } },
        },
      },
    },
  });
  return rows.map((k) => ({
    id: k.id,
    nomi: k.nomi,
    turi: k.turi,
    aktiv: k.aktiv,
    tartib: k.tartib,
    azolar: k.azolar
      .filter((a) => !a.employee.deletedAt)
      .map((a) => ({
        id: a.employee.id,
        ism: a.employee.ism,
        rasmUrl: a.employee.rasmUrl,
        isActive: a.employee.isActive,
        userId: a.employee.userId,
      }))
      .sort((a, b) => a.ism.localeCompare(b.ism)),
  }));
}

/**
 * CRM "Yangi zakaz" formasi uchun: FAOL kategoriyalar, har birida FAOL
 * a'zolar. Bo'sh kategoriya ham qaytadi (selektor "Tanlanmagan" ko'rsatadi).
 */
export async function crmFormaKategoriyalari(businessId: string): Promise<KategoriyaDTO[]> {
  const hammasi = await listKategoriyalar(businessId);
  return hammasi
    .filter((k) => k.aktiv)
    .map((k) => ({ ...k, azolar: k.azolar.filter((a) => a.isActive) }));
}

export async function createKategoriya(businessId: string, data: KategoriyaCreateInput) {
  const bor = await prisma.employeeCategory.findFirst({
    where: { businessId, nomi: data.nomi },
    select: { id: true },
  });
  if (bor) throw new BadRequestError("Bu nomdagi kategoriya allaqachon bor");

  // Tartib berilmasa — oxiriga.
  let tartib = data.tartib;
  if (tartib === undefined) {
    const oxirgi = await prisma.employeeCategory.findFirst({
      where: { businessId },
      orderBy: { tartib: "desc" },
      select: { tartib: true },
    });
    tartib = (oxirgi?.tartib ?? -1) + 1;
  }

  return prisma.employeeCategory.create({
    data: { businessId, nomi: data.nomi, turi: data.turi, tartib },
  });
}

export async function updateKategoriya(businessId: string, id: string, data: KategoriyaPatchInput) {
  const mavjud = await prisma.employeeCategory.findFirst({ where: { id, businessId } });
  if (!mavjud) throw new ForbiddenError("Kategoriya topilmadi");

  if (data.nomi && data.nomi !== mavjud.nomi) {
    const band = await prisma.employeeCategory.findFirst({
      where: { businessId, nomi: data.nomi, id: { not: id } },
      select: { id: true },
    });
    if (band) throw new BadRequestError("Bu nomdagi kategoriya allaqachon bor");
  }

  return prisma.employeeCategory.update({
    where: { id },
    data: {
      ...(data.nomi !== undefined ? { nomi: data.nomi } : {}),
      ...(data.turi !== undefined ? { turi: data.turi } : {}),
      ...(data.aktiv !== undefined ? { aktiv: data.aktiv } : {}),
      ...(data.tartib !== undefined ? { tartib: data.tartib } : {}),
    },
  });
}

/**
 * Kategoriya a'zoligini TO'LIQ almashtirish. A'zolikdan chiqarish tarixga
 * ta'sir qilmaydi — zakaz biriktiruvlari (DealEmployee) alohida saqlanadi.
 */
export async function kategoriyaAzolariniSaqlash(
  businessId: string,
  categoryId: string,
  employeeIds: string[]
) {
  const kategoriya = await prisma.employeeCategory.findFirst({
    where: { id: categoryId, businessId },
    select: { id: true },
  });
  if (!kategoriya) throw new ForbiddenError("Kategoriya topilmadi");

  const noyob = [...new Set(employeeIds)];
  if (noyob.length > 0) {
    const xodimlar = await prisma.employee.count({
      where: { id: { in: noyob }, businessId, deletedAt: null },
    });
    if (xodimlar !== noyob.length) {
      throw new ForbiddenError("Ro'yxatda bu biznesga tegishli bo'lmagan xodim bor");
    }
  }

  const hozirgi = await prisma.employeeCategoryMember.findMany({
    where: { categoryId, businessId },
    select: { id: true, employeeId: true },
  });
  const hozirgiIdlar = new Set(hozirgi.map((a) => a.employeeId));
  const yangiIdlar = new Set(noyob);

  const ochiriladigan = hozirgi.filter((a) => !yangiIdlar.has(a.employeeId)).map((a) => a.id);
  const qoshiladigan = noyob.filter((id) => !hozirgiIdlar.has(id));

  if (ochiriladigan.length > 0) {
    await prisma.employeeCategoryMember.deleteMany({ where: { id: { in: ochiriladigan }, businessId } });
  }
  for (const employeeId of qoshiladigan) {
    await prisma.employeeCategoryMember.create({ data: { businessId, categoryId, employeeId } });
  }

  return { qoshildi: qoshiladigan.length, ochirildi: ochiriladigan.length };
}

export interface ZakazXodimDTO {
  id: string;
  categoryId: string;
  kategoriyaNomi: string;
  kategoriyaTuri: string;
  employeeId: string;
  ism: string;
  rasmUrl: string | null;
}

/** Zakazning joriy biriktiruvlari (tafsilot oynasi uchun). */
export async function zakazXodimlari(businessId: string, dealId: string): Promise<ZakazXodimDTO[]> {
  const rows = await prisma.dealEmployee.findMany({
    where: { businessId, dealId },
    include: {
      category: { select: { nomi: true, turi: true, tartib: true } },
      employee: { select: { ism: true, rasmUrl: true } },
    },
  });
  return rows
    .sort((a, b) => a.category.tartib - b.category.tartib)
    .map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      kategoriyaNomi: r.category.nomi,
      kategoriyaTuri: r.category.turi,
      employeeId: r.employeeId,
      ism: r.employee.ism,
      rasmUrl: r.employee.rasmUrl,
    }));
}

/**
 * Biriktiruv ro'yxatini tekshiradi (buyurtma yaratilishidan OLDIN ham
 * chaqiriladi — xato bo'lsa buyurtma umuman yaratilmasin): kategoriya shu
 * biznesniki va FAOL, xodim shu biznesniki va o'sha kategoriya A'ZOSI.
 * Dublikat juftliklar chiqarilgan ro'yxat qaytadi.
 */
export async function zakazXodimlariniTekshir(
  businessId: string,
  items: ZakazXodimInput[]
): Promise<ZakazXodimInput[]> {
  const noyob = new Map<string, ZakazXodimInput>();
  for (const it of items) noyob.set(`${it.categoryId}:${it.employeeId}`, it);
  const royxat = [...noyob.values()];

  if (royxat.length > 0) {
    const azoliklar = await prisma.employeeCategoryMember.findMany({
      where: {
        businessId,
        categoryId: { in: royxat.map((r) => r.categoryId) },
        employeeId: { in: royxat.map((r) => r.employeeId) },
        category: { aktiv: true },
        employee: { deletedAt: null },
      },
      select: { categoryId: true, employeeId: true },
    });
    const bor = new Set(azoliklar.map((a) => `${a.categoryId}:${a.employeeId}`));
    for (const r of royxat) {
      if (!bor.has(`${r.categoryId}:${r.employeeId}`)) {
        throw new ForbiddenError("Xodim tanlangan kategoriyaning a'zosi emas");
      }
    }
  }
  return royxat;
}

/**
 * ZAKAZ XODIMLARINI TO'LIQ ALMASHTIRISH.
 *
 * Qoidalar:
 *  - kirim yozilgan (transactionId bor) buyurtmada QULFLANADI — yakunlangan
 *    zakaz statistikasi keyin o'zgarib qolmasin;
 *  - kategoriya shu biznesniki va FAOL bo'lishi shart;
 *  - xodim shu biznesniki va o'sha kategoriya A'ZOSI bo'lishi shart
 *    (frontend selektorlari ham shu ro'yxatni ko'rsatadi — server majburlaydi).
 */
export async function zakazXodimlariniSaqlash(
  businessId: string,
  dealId: string,
  items: ZakazXodimInput[]
) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, businessId, deletedAt: null },
    select: { id: true, transactionId: true },
  });
  if (!deal) throw new ForbiddenError("Buyurtma topilmadi");
  if (deal.transactionId) {
    throw new BadRequestError("Kirim yozilgan buyurtmaning xodimlari o'zgartirilmaydi");
  }

  const royxat = await zakazXodimlariniTekshir(businessId, items);

  await prisma.dealEmployee.deleteMany({ where: { dealId, businessId } });
  for (const r of royxat) {
    await prisma.dealEmployee.create({
      data: { businessId, dealId, categoryId: r.categoryId, employeeId: r.employeeId },
    });
  }

  return zakazXodimlari(businessId, dealId);
}

/**
 * SOTUVCHI → MAS'UL sinxroni: biriktiruvlar ichida "sotuvchi" turidagi
 * kategoriyaga tayinlangan, tizim hisobi bog'langan xodim bo'lsa — o'sha
 * foydalanuvchi qaytadi. Deal.masulId shu qiymatga o'rnatiladi, shunda
 * CRM→Kirim ko'chirilganda `Transaction.sotuvchiId` (mavjud xodim
 * statistikasi) ham AYNI sotuvchiga yoziladi — ikki tizim bir haqiqat.
 */
export async function sotuvchiUserIdTop(
  businessId: string,
  items: ZakazXodimInput[]
): Promise<string | null> {
  if (items.length === 0) return null;
  const sotuvKategoriyalar = await prisma.employeeCategory.findMany({
    where: { businessId, id: { in: items.map((i) => i.categoryId) }, turi: "sotuvchi" },
    select: { id: true },
  });
  const sotuvIdlar = new Set(sotuvKategoriyalar.map((k) => k.id));
  const sotuvchiItem = items.find((i) => sotuvIdlar.has(i.categoryId));
  if (!sotuvchiItem) return null;

  const xodim = await prisma.employee.findFirst({
    where: { id: sotuvchiItem.employeeId, businessId, deletedAt: null },
    select: { userId: true },
  });
  return xodim?.userId ?? null;
}
