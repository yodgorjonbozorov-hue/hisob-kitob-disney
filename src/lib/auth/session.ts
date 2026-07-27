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

export const sessionOptions: SessionOptions = {
  cookieName: "disney_navoiy_session",
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
