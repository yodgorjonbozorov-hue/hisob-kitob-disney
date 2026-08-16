import { prisma } from "@/lib/prisma";
import { requestCache } from "@/lib/requestCache";
import { ForbiddenError } from "@/lib/auth/guard";
import { normalizeRol } from "@/lib/auth/roles";
import { ROL_DEFAULT_HUQUQLAR, huquqJsonParse } from "./katalog";

/**
 * EFFEKTIV HUQUQLARNI HISOBLASH (server).
 *
 * Tartib:
 *  1. BAZA: maxsus rol tayinlangan bo'lsa — Role.huquqlar; aks holda tizim
 *     rolining default to'plami (katalog.ROL_DEFAULT_HUQUQLAR).
 *  2. + User.huquqPlus (alohida berilgan huquqlar);
 *  3. − User.huquqMinus (alohida olib qo'yilgan huquqlar).
 *
 * OWNER hech qachon cheklanmaydi — o'zini o'zi qulflab qo'yish xavfi yo'q.
 */

export interface HuquqManbai {
  rol: string;
  role?: { huquqlar: string; isActive: boolean; deletedAt: Date | null } | null;
  huquqPlus?: string | null;
  huquqMinus?: string | null;
}

/** SOF funksiya — testlash oson. */
export function effektivHuquqlar(u: HuquqManbai): Set<string> {
  const rol = normalizeRol(u.rol);
  if (rol === "OWNER" || rol === "SUPERADMIN") {
    return new Set(ROL_DEFAULT_HUQUQLAR.OWNER);
  }
  const rolFaol = u.role && u.role.isActive && !u.role.deletedAt;
  const baza = rolFaol ? huquqJsonParse(u.role!.huquqlar) : ROL_DEFAULT_HUQUQLAR[rol] ?? [];
  const natija = new Set(baza);
  for (const k of huquqJsonParse(u.huquqPlus)) natija.add(k);
  for (const k of huquqJsonParse(u.huquqMinus)) natija.delete(k);
  return natija;
}

/**
 * Bir so'rov ichida bir necha huquq tekshirilsa — bitta DB lookup (kalit: userId).
 * Tenant-scoped `prisma` — boshqa tenant useri bu yerda ko'rinmaydi.
 */
const userHuquqManbai = requestCache(async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      rol: true,
      isActive: true,
      huquqPlus: true,
      huquqMinus: true,
      role: { select: { huquqlar: true, isActive: true, deletedAt: true } },
    },
  })
);

/** Foydalanuvchining effektiv huquqlari (tenant kontekstida chaqiriladi). */
export async function userHuquqlari(userId: string): Promise<Set<string>> {
  const u = await userHuquqManbai(userId);
  if (!u || !u.isActive) return new Set();
  return effektivHuquqlar(u);
}

/** Huquq bormi (server, tenant kontekstida). */
export async function hasPermission(userId: string, code: string): Promise<boolean> {
  const huquqlar = await userHuquqlari(userId);
  return huquqlar.has(code);
}

/** Huquq bo'lmasa ForbiddenError — API routelarda ishlatiladi. */
export async function requirePermission(userId: string, code: string): Promise<void> {
  if (!(await hasPermission(userId, code))) {
    throw new ForbiddenError("Bu amal uchun sizda huquq yo'q");
  }
}
