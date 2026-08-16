/**
 * HISOBNI O'CHIRISH — kompaniya (tenant) hisobini butunlay o'chirish.
 *
 * NEGA BOR: App Store 5.1.1(v) — ilovada ro'yxatdan o'tish bo'lsa, hisobni
 * O'CHIRISH ham ilova ICHIDAN boshlanishi shart. "Bizga yozing" yetarli emas.
 *
 * Oqim:
 *   1. Egasi so'raydi  → `deletionRequestedAt` yoziladi, kirish DARHOL yopiladi.
 *   2. 30 kun kutish   → shu muddatda egasi fikridan qaytib tiklay oladi.
 *   3. Cron o'chiradi  → ma'lumot butunlay yo'q qilinadi (qaytarib bo'lmaydi).
 *
 * Bu fayl `src/lib/db/` da — tizim darajasidagi amal, tenant filtridan
 * tashqarida ishlaydi (CLAUDE.md: rawPrisma shu yerda ruxsat etilgan).
 */

import { rawPrisma } from "@/lib/db/rawPrisma";
import { ZAXIRA_JADVALLARI } from "@/lib/backup/dump";
import { BUSINESS_SCOPED_MODELLAR, TENANT_DIRECT, TIZIM_MODELLAR } from "@/lib/db/tenantDb";

/** O'ylab ko'rish muddati. Shu kunlar ichida o'chirishni bekor qilish mumkin. */
export const OYLASH_KUNI = 30;

const KUN_MS = 24 * 60 * 60 * 1000;

/** `"purchaseOrderItem"` → `"PurchaseOrderItem"`. */
function modelNomi(jadval: string): string {
  return jadval.charAt(0).toUpperCase() + jadval.slice(1);
}

/**
 * Har bir zaxira jadvali qanday o'chirilishini aniqlaydi.
 *
 * FAIL-CLOSED: yangi model qo'shilib bu yerga tushmasa, `"nomalum"` qaytadi va
 * o'chirish TO'XTAYDI. Aks holda o'chirilmagan jadval qolib, FK xatosi bo'lardi
 * yoki (battari) mijoz ma'lumoti bazada qolib ketardi.
 * `tests/hisob-ochirish.test.ts` buni majburlaydi.
 */
export type OchirishUsuli = "tenant" | "biznes" | "tizim" | "ildiz" | "nomalum";

export function ochirishUsuli(jadval: string): OchirishUsuli {
  const model = modelNomi(jadval);
  if (model === "Tenant") return "ildiz";
  if (model === "AuditLog") return "tenant"; // tenantId bor, ro'yxatlarda emas
  if (TENANT_DIRECT.has(model)) return "tenant";
  if (BUSINESS_SCOPED_MODELLAR.has(model)) return "biznes";
  // ATAYLAB tenantsiz tizim jadvallari (masalan AppSetting) — tegilmaydi.
  if (model in TIZIM_MODELLAR) return "tizim";
  return "nomalum";
}

/** Tenant o'chirilganda jadvallar qaysi tartibda tozalanadi. */
export function ochirishTartibi(): string[] {
  // Zaxira ro'yxati bog'liqlik tartibida: jadval o'zi murojaat qiladigan
  // JADVALLARDAN KEYIN turadi. Demak TESKARI tartib — murojaat qiluvchi
  // avval o'chiriladi, ya'ni FK cheklovlari buzilmaydi.
  return [...ZAXIRA_JADVALLARI].reverse();
}

/** Nomalum jadvallar ro'yxati (test va ishga tushishdan oldingi tekshiruv uchun). */
export function nomalumJadvallar(): string[] {
  return ochirishTartibi().filter((j) => ochirishUsuli(j) === "nomalum");
}

/**
 * O'chirishni so'raydi. Ma'lumotga TEGMAYDI — faqat belgi qo'yadi.
 * Qayta so'ralsa vaqt YANGILANMAYDI (30 kunlik muddat cho'zilib ketmasin).
 */
export async function ochirishSora(tenantId: string, userId: string): Promise<Date> {
  const tenant = await rawPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { deletionRequestedAt: true },
  });
  if (tenant?.deletionRequestedAt) return tenant.deletionRequestedAt;

  const now = new Date();
  await rawPrisma.tenant.update({
    where: { id: tenantId },
    data: { deletionRequestedAt: now, deletionRequestedBy: userId },
  });
  return now;
}

/** O'chirishni bekor qiladi (30 kun ichida). */
export async function ochirishBekor(tenantId: string): Promise<void> {
  await rawPrisma.tenant.update({
    where: { id: tenantId },
    data: { deletionRequestedAt: null, deletionRequestedBy: null },
  });
}

/** Muddat tugagan (o'chirishga tayyor) kompaniyalar. */
export async function ochirishgaTayyor(now: Date = new Date()): Promise<string[]> {
  const chegara = new Date(now.getTime() - OYLASH_KUNI * KUN_MS);
  const royxat = await rawPrisma.tenant.findMany({
    where: { deletionRequestedAt: { not: null, lte: chegara } },
    select: { id: true },
  });
  return royxat.map((t) => t.id);
}

/** So'rovdan keyin necha kun qolganini hisoblaydi (0 — muddat tugagan). */
export function qolganKun(soralgan: Date, now: Date = new Date()): number {
  const otgan = (now.getTime() - soralgan.getTime()) / KUN_MS;
  return Math.max(0, Math.ceil(OYLASH_KUNI - otgan));
}

/**
 * Kompaniyani va unga tegishli BARCHA ma'lumotni butunlay o'chiradi.
 * QAYTARIB BO'LMAYDI.
 *
 * Bitta tranzaksiyada bajariladi: yarim o'chirilgan kompaniya qolmaydi.
 */
export async function tenantniButunlayOchir(tenantId: string): Promise<{ ochirildi: number }> {
  const nomalum = nomalumJadvallar();
  if (nomalum.length > 0) {
    // Yangi model zaxira ro'yxatiga qo'shilgan, lekin qanday o'chirilishi
    // aniqlanmagan. Yarim o'chirishdan ko'ra umuman o'chirmagan yaxshi.
    throw new Error(
      `Ochirish tartibi to'liq emas — nomalum jadvallar: ${nomalum.join(", ")}. ` +
        "lib/db/hisobOchirish.ts dagi ochirishUsuli() ni yangilang.",
    );
  }

  const bizneslar = await rawPrisma.business.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const businessIds = bizneslar.map((b) => b.id);

  let ochirildi = 0;
  await rawPrisma.$transaction(async (tx) => {
    for (const jadval of ochirishTartibi()) {
      const usul = ochirishUsuli(jadval);
      if (usul === "tizim" || usul === "ildiz") continue;

      // Prisma delegatlari model nomining kichik harfli ko'rinishi bilan
      // indekslanadi — `ZAXIRA_JADVALLARI` aynan shu ko'rinishda yozilgan.
      const delegat = (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<{ count: number }> }>)[
        jadval
      ];
      if (!delegat) throw new Error(`Prisma delegati topilmadi: ${jadval}`);

      if (usul === "biznes") {
        // Biznesi yo'q tenantda o'chiradigan narsa ham yo'q.
        if (businessIds.length === 0) continue;
        const n = await delegat.deleteMany({ where: { businessId: { in: businessIds } } });
        ochirildi += n.count;
      } else {
        const n = await delegat.deleteMany({ where: { tenantId } });
        ochirildi += n.count;
      }
    }
    await tx.tenant.delete({ where: { id: tenantId } });
    ochirildi += 1;
  });

  return { ochirildi };
}
