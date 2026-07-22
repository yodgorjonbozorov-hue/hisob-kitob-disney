import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { redirect } from "next/navigation";

export type Rol = "admin" | "kassir";

export interface SessionData {
  userId?: string;
  login?: string;
  ism?: string;
  rol?: Rol;
  // Kassir uchun biriktirilgan biznes id; admin uchun null (barcha bizneslar).
  businessId?: string | null;
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
  return session as Required<SessionData>;
}

/** API route handlerlari uchun — redirect qilmaydi, null qaytaradi. */
export async function getCurrentUser(): Promise<Required<SessionData> | null> {
  const session = await getSession();
  if (!session.userId || !session.rol || !session.login || !session.ism) {
    return null;
  }
  return session as Required<SessionData>;
}
