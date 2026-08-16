import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
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

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/**
 * Sessiya cookie'sini o'chiradi (guard foydalanuvchini rad etganda chaqiriladi:
 * o'chirilgan/deaktiv akkaunt cookie'si diskda qolib ketmasin).
 *
 * Next.js cookie'ni FAQAT Route Handler va Server Action ichida yozishga ruxsat
 * beradi — Server Component'da `destroy()` xato tashlaydi. Shuning uchun xato
 * yutiladi: u yerda kirishni redirect yopadi va cookie keyingi API so'rovida
 * (yoki logout'da) o'chadi. Sessiyani yaroqsiz deb hisoblash qarori HAR DOIM
 * bazadagi holatga qarab chiqariladi, cookie borligiga emas — ya'ni cookie
 * o'chmay qolishi kirish ochiq qolishini ANGLATMAYDI.
 */
export async function destroySession(): Promise<void> {
  try {
    const session = await getSession();
    session.destroy();
  } catch {
    // Server Component konteksti (yoki request'siz muhit) — cookie'ga yozib bo'lmaydi.
  }
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
