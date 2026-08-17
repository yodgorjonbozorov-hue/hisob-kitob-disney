/**
 * MOBIL SESSIYA — native ilova (iOS) uchun token autentifikatsiyasi.
 *
 * NEGA JWT EMAS: JWT'ning yagona ustunligi — serverga murojaat qilmasdan
 * tekshirish. Lekin Balansada har so'rov baribir foydalanuvchi va tenantni
 * bazadan o'qiydi (`lib/auth/tenant.ts` → `userTenantIdCached`), ya'ni
 * bitta so'rov baribir bo'ladi. JWT hech narsa tejamaydi, lekin qo'shimcha
 * xavf keltiradi (alg confusion, bekor qilib bo'lmaslik, kalit almashtirish).
 *
 * Shuning uchun OPAQUE token: 32 bayt tasodifiy, bazada faqat SHA-256 xeshi.
 * Ustunliklari:
 *   - darhol bekor qilinadi (chiqish, o'g'irlik, xodim ishdan bo'shatilishi);
 *   - baza o'g'irlansa tokenlar ishlatib bo'lmaydi (xesh saqlanadi);
 *   - qo'shimcha kutubxona kerak emas (node:crypto yetarli).
 *
 * IKKI TOKEN:
 *   access  — 15 daqiqa, har so'rovda `Authorization: Bearer <token>`;
 *   refresh — 30 kun, iOS Keychain'da Face ID ortida saqlanadi.
 *
 * ROTATSIYA: har yangilashda ikkalasi ham yangilanadi, eskisi ishlatilgan
 * deb belgilanadi. Ishlatilgan refresh QAYTA kelsa — o'g'irlik belgisi,
 * o'sha qurilmaning barcha tokenlari bekor qilinadi.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
// Token tenant aniqlanishidan OLDIN o'qiladi — bu autentifikatsiya qatlami
// (CLAUDE.md: rawPrisma `src/lib/auth/` da ruxsat etilgan).
import { rawPrisma } from "@/lib/db/rawPrisma";
import { normalizeRol, type Rol } from "./roles";

/** Access token muddati — qisqa: log yoki proksida oqib ketsa zarari kam. */
export const ACCESS_DAQIQA = 15;
/** Refresh muddati — foydalanuvchi oyiga bir marta ham kirmasligi mumkin. */
export const REFRESH_KUN = 30;

const DAQIQA_MS = 60 * 1000;
const KUN_MS = 24 * 60 * 60 * 1000;

export interface TokenJuftligi {
  access: string;
  refresh: string;
  /** Access qachon tugaydi — klient oldindan yangilashi uchun. */
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

/** Token egasi — `withTenant` shu ma'lumot bilan ishlaydi. */
export interface MobilSessiya {
  userId: string;
  login: string;
  ism: string;
  rol: Rol;
  tenantId: string | null;
  businessId: string | null;
  mustChangePassword: boolean;
  deviceId: string;
}

/** Xom token: 32 bayt entropiya, URL-xavfsiz. */
function tokenYarat(): string {
  return randomBytes(32).toString("base64url");
}

/** Bazada FAQAT shu xesh saqlanadi. */
function xesh(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * `Authorization: Bearer <token>` sarlavhasidan tokenni ajratadi.
 * Format noto'g'ri bo'lsa null.
 */
export function bearerToken(sarlavha: string | null): string | null {
  if (!sarlavha) return null;
  const [sxema, qiymat] = sarlavha.split(" ");
  if (!qiymat || sxema.toLowerCase() !== "bearer") return null;
  return qiymat.trim() || null;
}

/**
 * Qurilma uchun yangi token juftligi yaratadi.
 *
 * MUHIM: eski tokenlar bekor QILINMAYDI — foydalanuvchi bir necha
 * qurilmada bir vaqtda ishlashi mumkin (telefon + planshet). Faqat
 * O'SHA qurilmaning eski tokenlari almashtiriladi.
 */
export async function tokenJuftligiYarat(
  userId: string,
  deviceId: string,
  deviceNom?: string | null,
): Promise<TokenJuftligi> {
  const now = Date.now();
  const access = tokenYarat();
  const refresh = tokenYarat();
  const accessExpiresAt = new Date(now + ACCESS_DAQIQA * DAQIQA_MS);
  const refreshExpiresAt = new Date(now + REFRESH_KUN * KUN_MS);

  await rawPrisma.mobileToken.createMany({
    data: [
      { tokenHash: xesh(access), turi: "access", userId, deviceId, deviceNom: deviceNom ?? null, expiresAt: accessExpiresAt },
      { tokenHash: xesh(refresh), turi: "refresh", userId, deviceId, deviceNom: deviceNom ?? null, expiresAt: refreshExpiresAt },
    ],
  });

  return { access, refresh, accessExpiresAt, refreshExpiresAt };
}

/**
 * Access token bo'yicha sessiyani tiklaydi.
 *
 * `null` qaytishi mumkin bo'lgan sabablar (hammasi bir xil natija —
 * klient `/refresh` ga boradi): token yo'q, muddati o'tgan, bekor
 * qilingan, foydalanuvchi o'chirilgan yoki bloklangan.
 */
export async function accessTokenSessiya(token: string): Promise<MobilSessiya | null> {
  const yozuv = await rawPrisma.mobileToken.findUnique({
    where: { tokenHash: xesh(token) },
    select: {
      turi: true,
      deviceId: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true, login: true, ism: true, rol: true, isActive: true,
          tenantId: true, businessId: true, mustChangePassword: true,
        },
      },
    },
  });

  if (!yozuv || yozuv.turi !== "access") return null;
  if (yozuv.revokedAt || yozuv.expiresAt.getTime() <= Date.now()) return null;
  if (!yozuv.user.isActive) return null;

  return {
    userId: yozuv.user.id,
    login: yozuv.user.login,
    ism: yozuv.user.ism,
    rol: normalizeRol(yozuv.user.rol),
    tenantId: yozuv.user.tenantId,
    businessId: yozuv.user.businessId,
    mustChangePassword: yozuv.user.mustChangePassword ?? false,
    deviceId: yozuv.deviceId,
  };
}

export type YangilashNatijasi =
  | { holat: "ok"; juftlik: TokenJuftligi }
  | { holat: "yaroqsiz" }
  /** Ishlatilgan refresh qayta keldi — qurilma bekor qilindi. */
  | { holat: "ogirlik" };

/**
 * Refresh tokenni yangi juftlikka almashtiradi (ROTATSIYA).
 *
 * O'G'IRLIK ANIQLASH: refresh bir marta ishlatilgach `ishlatilganAt` bilan
 * belgilanadi. Agar O'SHA token yana kelsa — demak uni kimdir nusxalagan
 * (haqiqiy klientda allaqachon yangisi bor). Bunday holatda o'sha
 * QURILMANING barcha tokenlari bekor qilinadi va foydalanuvchi qayta
 * kirishga majbur bo'ladi.
 */
export async function tokenYangila(refresh: string): Promise<YangilashNatijasi> {
  const yozuv = await rawPrisma.mobileToken.findUnique({
    where: { tokenHash: xesh(refresh) },
    select: {
      id: true, turi: true, userId: true, deviceId: true, deviceNom: true,
      expiresAt: true, revokedAt: true, ishlatilganAt: true,
      user: { select: { isActive: true } },
    },
  });

  if (!yozuv || yozuv.turi !== "refresh") return { holat: "yaroqsiz" };

  // Qayta ishlatishga urinish — o'g'irlik.
  if (yozuv.ishlatilganAt) {
    await qurilmaniBekorQil(yozuv.userId, yozuv.deviceId);
    return { holat: "ogirlik" };
  }

  if (yozuv.revokedAt || yozuv.expiresAt.getTime() <= Date.now()) return { holat: "yaroqsiz" };
  if (!yozuv.user.isActive) return { holat: "yaroqsiz" };

  const now = new Date();
  // Eski juftlikni yopamiz: refresh "ishlatilgan", access esa darhol bekor
  // (aks holda eski access yana 15 daqiqa ishlab turardi).
  await rawPrisma.$transaction([
    rawPrisma.mobileToken.update({
      where: { id: yozuv.id },
      data: { ishlatilganAt: now, revokedAt: now },
    }),
    rawPrisma.mobileToken.updateMany({
      where: { userId: yozuv.userId, deviceId: yozuv.deviceId, turi: "access", revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  const juftlik = await tokenJuftligiYarat(yozuv.userId, yozuv.deviceId, yozuv.deviceNom);
  return { holat: "ok", juftlik };
}

/** Bitta qurilmaning barcha tokenlarini bekor qiladi (chiqish yoki o'g'irlik). */
export async function qurilmaniBekorQil(userId: string, deviceId: string): Promise<void> {
  await rawPrisma.mobileToken.updateMany({
    where: { userId, deviceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Foydalanuvchining BARCHA qurilmalarini bekor qiladi (parol o'zgarganda). */
export async function hammaQurilmalarniBekorQil(userId: string): Promise<void> {
  await rawPrisma.mobileToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Muddati o'tgan va bekor qilingan tokenlarni tozalaydi (cron).
 * Bekor qilinganlar darhol emas, 7 kundan keyin o'chiriladi — o'g'irlik
 * tekshiruvi uchun qisqa tarix qoladi.
 */
export async function eskiTokenlarniTozala(now: Date = new Date()): Promise<number> {
  const chegara = new Date(now.getTime() - 7 * KUN_MS);
  const natija = await rawPrisma.mobileToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: chegara } }],
    },
  });
  return natija.count;
}

/**
 * Ikki maxfiy qiymatni vaqt bo'yicha xavfsiz solishtiradi.
 * (Tokenlar xesh bo'yicha indeks orqali topiladi, lekin qo'shimcha
 * solishtirish kerak bo'lgan joylar uchun.)
 */
export function xavfsizTeng(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}
