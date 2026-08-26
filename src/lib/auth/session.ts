import { cookies, headers } from "next/headers";
import {
  getIronSession,
  sealData,
  unsealData,
  type IronSession,
  type SessionOptions,
} from "iron-session";
import { redirect } from "next/navigation";
import { normalizeRol, type Rol } from "./roles";

export type { Rol };

export interface SessionData {
  userId?: string;
  login?: string;
  ism?: string;
  rol?: Rol;
  // Tenant a'zoligi; SUPERADMIN uchun null. Eski sessiyalarda bo'lmasligi mumkin.
  tenantId?: string | null;
  // Kassir uchun biriktirilgan biznes id; owner/admin/seller uchun null (tenant ichidagi barcha bizneslar).
  businessId?: string | null;
  // Seed/boshlang'ich parolni majburiy almashtirish kerakmi.
  mustChangePassword?: boolean;
  // Impersonatsiya: SUPERADMIN tenant nomidan kirganda uning userId'si shu yerda saqlanadi.
  impersonatedBy?: string | null;
  /**
   * SESSIYA AVLODI (Superadmin 2.0). Login paytida `User.sessionEpoch` shu
   * yerga ko'chiriladi; guard har so'rovda bazadagi qiymat bilan solishtiradi.
   * Bazadagi raqam oshirilsa — shu foydalanuvchining BARCHA cookie'lari
   * bir zumda kuchsizlanadi ("sessiyani bekor qilish").
   *
   * Eski (migratsiyagacha ochilgan) sessiyalarda maydon yo'q — `0` deb
   * o'qiladi, ya'ni hech kim tizimdan chiqarilmaydi.
   */
  sessionEpoch?: number;
}

/**
 * Cookie nomi brend bilan birga o'zgardi. Eski `disney_navoiy_session` cookie'lari
 * e'tiborga olinmaydi — foydalanuvchi qayta login qiladi. (Domen ham `balansa.uz`ga
 * ko'chgani uchun eski cookie'lar baribir ko'chmaydi.)
 */
export const sessionOptions: SessionOptions = {
  cookieName: "balansa_session",
  password: process.env.SESSION_SECRET as string,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 kun
  },
};

/**
 * MOBIL SESSIYA (Bearer token). Native ilova cookie yuritmaydi — login javobida
 * xuddi shu iron-seal qiymati `token` sifatida qaytariladi va keyingi so'rovlarda
 * `Authorization: Bearer <token>` bilan keladi. Muhri, TTL'i va ichidagi
 * ma'lumot cookie sessiya bilan BIR XIL, shu sabab pastdagi barcha guard'lar
 * (sessionEpoch, isActive, tenant tekshiruvi) o'zgarishsiz ishlayveradi.
 * Token stateless — bekor qilish yo'li ham o'sha: `User.sessionEpoch` oshiriladi.
 */
const MOBIL_SESSIYA_TTL = 60 * 60 * 24 * 7; // 7 kun, cookie maxAge bilan teng

export async function sealMobileSession(data: SessionData): Promise<string> {
  return sealData(data, {
    password: process.env.SESSION_SECRET as string,
    ttl: MOBIL_SESSIYA_TTL,
  });
}

async function bearerSessionData(): Promise<SessionData | null> {
  let token: string | null = null;
  try {
    const h = await headers();
    const auth = h.get("authorization");
    if (auth?.startsWith("Bearer ")) token = auth.slice(7).trim() || null;
  } catch {
    // headers() faqat request kontekstida mavjud (masalan bot/cron skriptlarida emas)
    return null;
  }
  if (!token) return null;
  try {
    const data = await unsealData<SessionData>(token, {
      password: process.env.SESSION_SECRET as string,
      ttl: MOBIL_SESSIYA_TTL,
    });
    if (data && typeof data === "object" && data.userId) return data;
  } catch {
    // Yaroqsiz/muddati o'tgan token (yoki CRON_SECRET kabi boshqa Bearer) —
    // cookie yo'liga tushamiz; cookie ham bo'lmasa oddiy 401 bo'ladi.
  }
  return null;
}

/**
 * Bearer sessiya o'zgarmas (immutable): save/destroy hech narsa qilmaydi —
 * token klient qo'lida, server uni o'zgartira olmaydi. Sessiyani yangilash
 * talab qilinadigan amallar (parol almashtirish) mobil klientda qayta login
 * bilan yakunlanadi.
 */
function bearerSessionShim(data: SessionData): IronSession<SessionData> {
  const shim = {
    ...data,
    save: async () => {},
    destroy: () => {},
    updateConfig: () => {},
  };
  return shim as unknown as IronSession<SessionData>;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const bearer = await bearerSessionData();
  if (bearer) return bearerSessionShim(bearer);
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Sessiyada userId yo'q bo'lsa, /login sahifasiga redirect qiladi. Server Component/layout uchun. */
export async function requireUser(): Promise<Required<SessionData>> {
  const session = await getSession();
  if (!session.userId || !session.rol || !session.login || !session.ism) {
    redirect("/login");
  }
  // Migratsiyagacha ochilgan sessiyalarda eski rol nomlari bo'lishi mumkin.
  session.rol = normalizeRol(session.rol);
  return session as Required<SessionData>;
}

/** API route handlerlari uchun — redirect qilmaydi, null qaytaradi. */
export async function getCurrentUser(): Promise<Required<SessionData> | null> {
  const session = await getSession();
  if (!session.userId || !session.rol || !session.login || !session.ism) {
    return null;
  }
  session.rol = normalizeRol(session.rol);
  return session as Required<SessionData>;
}
