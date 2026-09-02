import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import type { KategoriyaCreateInput, KategoriyaPatchInput } from "@/lib/validation/xodimKategoriya";

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
  /** Zakaz formasida chiqadimi. */
  zakazgaBiriktiriladi: boolean;
  /** Bir zakazga bir nechta xodim (multi-select). */
  kopXodim: boolean;
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
    zakazgaBiriktiriladi: k.zakazgaBiriktiriladi,
    kopXodim: k.kopXodim,
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
 * CRM "Yangi zakaz" formasi uchun: FAOL va zakazga biriktiriladigan
 * lavozimlar, har birida FAOL a'zolar. Bo'sh lavozim ham qaytadi (selektor
 * "Tanlanmagan" ko'rsatadi). Nofaol/o'chirilgan xodim yangi zakazga
 * tanlanmaydi — tarixiy biriktiruvlari esa o'z joyida qoladi.
 */
export async function crmFormaKategoriyalari(businessId: string): Promise<KategoriyaDTO[]> {
  const hammasi = await listKategoriyalar(businessId);
  return hammasi
    .filter((k) => k.aktiv && (k.zakazgaBiriktiriladi || k.turi === "sotuvchi"))
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
    data: {
      businessId,
      nomi: data.nomi,
      turi: data.turi,
      tartib,
      zakazgaBiriktiriladi: data.zakazgaBiriktiriladi ?? true,
      kopXodim: data.kopXodim ?? false,
    },
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
      ...(data.zakazgaBiriktiriladi !== undefined ? { zakazgaBiriktiriladi: data.zakazgaBiriktiriladi } : {}),
      ...(data.kopXodim !== undefined ? { kopXodim: data.kopXodim } : {}),
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

/**
 * ZAKAZ JAMOASI (biriktiruv) mantiqi `lib/services/zakazJamoasi.ts` ga
 * ko'chdi — eski import yo'llari buzilmasin deb shu yerdan qayta eksport.
 */
export {
  zakazXodimlari,
  zakazXodimlariniTekshir,
  zakazXodimlariniSaqlash,
  sotuvchiUserIdTop,
  type ZakazXodimDTO,
} from "@/lib/services/zakazJamoasi";
