import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/guard";
import { isManager } from "@/lib/auth/roles";

/**
 * SOTUVCHI/XODIM XIZMATI — kirim yozuvida savdo kimning hisobiga yozilishini
 * hal qiladi (xodim statistikasi uchun).
 *
 * Qoidalar:
 *  - Kirimda sotuvchi HAR DOIM to'ldiriladi: berilmasa — yozuvni kiritayotgan
 *    foydalanuvchining o'zi (sotuvchi o'z savdosini yozadi, bu odatiy holat).
 *  - BOSHQA xodimni tanlash faqat boshqaruvchiga (OWNER/ADMIN) — oddiy
 *    sotuvchi savdoni boshqa xodim nomiga yoza olmaydi.
 *  - Tanlangan xodim shu biznesga kirisha oladigan bo'lishi shart
 *    (UserBusiness qoidasi) — boshqa biznes xodimi ko'rinmaydi va o'tmaydi.
 *  - Chiqimda sotuvchi yozilmaydi (null).
 */

export interface SotuvchiSession {
  userId: string;
  rol: string;
}

/**
 * Xodim shu biznesga tegishlimi: biriktiruv qatori yo'q (cheklovsiz — tenant
 * ichidagi barcha bizneslar) YOKI aynan shu biznesga biriktirilgan
 * (`lib/business.ts` dagi ruxsat qoidasi bilan bir xil o'qish).
 */
const BIZNES_XODIMI_WHERE = (businessId: string) => ({
  isActive: true,
  // SUPERADMIN tenant-scoped prisma'da baribir ko'rinmaydi (tenantId null),
  // shart shunchaki ochiq hujjat uchun.
  rol: { not: "SUPERADMIN" },
  OR: [{ bizneslar: { none: {} } }, { bizneslar: { some: { businessId } } }],
});

/**
 * Kirim uchun yakuniy sotuvchini aniqlaydi va tekshiradi.
 * Chiqim uchun har doim null qaytaradi.
 */
export async function sotuvchiniHalQil(
  session: SotuvchiSession,
  businessId: string,
  data: { turi: "kirim" | "chiqim"; sotuvchiId?: string | null }
): Promise<string | null> {
  if (data.turi !== "kirim") return null;

  const sorlagan = data.sotuvchiId ?? null;
  if (!sorlagan || sorlagan === session.userId) return session.userId;

  if (!isManager(session.rol)) {
    throw new ForbiddenError("Boshqa xodim nomiga yozish faqat boshqaruvchiga ruxsat etilgan");
  }
  return tekshirilganSotuvchi(businessId, sorlagan);
}

/** Tanlangan xodim mavjud, faol va shu biznesga tegishli ekanini tekshiradi. */
export async function tekshirilganSotuvchi(businessId: string, sotuvchiId: string): Promise<string> {
  const xodim = await prisma.user.findFirst({
    where: { id: sotuvchiId, ...BIZNES_XODIMI_WHERE(businessId) },
    select: { id: true },
  });
  if (!xodim) throw new ForbiddenError("Tanlangan sotuvchi bu biznesga tegishli emas");
  return xodim.id;
}

export interface SotuvchiOption {
  id: string;
  ism: string;
}

/**
 * Shu biznesda ishlaydigan faol xodimlar — formadagi "Sotuvchi / Xodim"
 * tanlovi va qarz mas'uli ro'yxati uchun. Tenant izolyatsiyasi tenant-scoped
 * `prisma` da; biznes chegarasi shu yerdagi shartda.
 */
export async function listBiznesXodimlari(businessId: string): Promise<SotuvchiOption[]> {
  return prisma.user.findMany({
    where: BIZNES_XODIMI_WHERE(businessId),
    select: { id: true, ism: true },
    orderBy: { ism: "asc" },
    take: 200,
  });
}
