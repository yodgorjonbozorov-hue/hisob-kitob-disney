import { NextRequest, NextResponse } from "next/server";
// Login global (tenantlar aro) unique — autentifikatsiya rawPrisma bilan ishlaydi.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import { Prisma } from "@prisma/client";
import { registrsizTeng } from "@/lib/db/dialect";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeRol } from "@/lib/auth/roles";
import { tokenJuftligiYarat, ACCESS_DAQIQA, REFRESH_KUN } from "@/lib/auth/mobil";
import { mobilLoginSchema } from "@/lib/validation/mobil";
import { rateLimit, rateLimitReset } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";

/**
 * MOBIL KIRISH — native ilova uchun.
 *
 * Veb `/api/auth/login` dan farqi: cookie o'rniga token juftligi qaytaradi.
 * Qolgan mantiq (login topish, rate limit, umumiy xato matni) AYNAN bir xil —
 * ataylab takrorlangan, chunki veb yo'liga tegmaslik kerak edi.
 *
 * Rate limit veb bilan BIR XIL kalitlarni ishlatadi: brute-force'chi
 * mobil endpointga o'tib limitdan qochib qutula olmaydi.
 */

/** Registr farqini kechiradi (mobil klaviatura birinchi harfni kattalashtiradi). */
async function findUserByLogin(login: string) {
  const exact = await prisma.user.findUnique({ where: { login } });
  if (exact) return exact;

  const matches = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "User" WHERE ${registrsizTeng('"login"', login)} LIMIT 2`,
  );
  // Ikkita moslik bo'lsa hech biri tanlanmaydi — noto'g'ri akkauntga kirish xavfi.
  if (matches.length !== 1) return null;
  return prisma.user.findUnique({ where: { id: matches[0].id } });
}

const IP_OYNA = 5 * 60 * 1000;
const LOGIN_OYNA = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  const rlKey = `login:${ip}`;
  const rl = await rateLimit(rlKey, 8, IP_OYNA);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Juda ko'p urinish. ${rl.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 },
    );
  }

  const parsed = mobilLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Login yoki parol noto'g'ri" }, { status: 400 });
  }
  const { login, parol, deviceId, deviceNom } = parsed.data;

  const rlLoginKey = `login:l:${login.toLowerCase()}`;
  const rlLogin = await rateLimit(rlLoginKey, 5, LOGIN_OYNA);
  if (!rlLogin.ok) {
    return NextResponse.json(
      { error: `Bu login uchun juda ko'p urinish. ${rlLogin.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 },
    );
  }

  // Qaysi biri xato ekani AYTILMAYDI — mavjud loginni aniqlashga yo'l qo'ymaslik uchun.
  const umumiyXato = NextResponse.json({ error: "Login yoki parol noto'g'ri" }, { status: 401 });

  const user = await findUserByLogin(login);
  if (!user || !user.isActive) return umumiyXato;
  if (!(await verifyPassword(parol, user.parolHash))) return umumiyXato;

  await rateLimitReset(rlKey, IP_OYNA);
  await rateLimitReset(rlLoginKey, LOGIN_OYNA);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  const juftlik = await tokenJuftligiYarat(user.id, deviceId, deviceNom ?? null);

  return NextResponse.json({
    access: juftlik.access,
    refresh: juftlik.refresh,
    accessExpiresAt: juftlik.accessExpiresAt.toISOString(),
    refreshExpiresAt: juftlik.refreshExpiresAt.toISOString(),
    accessDaqiqa: ACCESS_DAQIQA,
    refreshKun: REFRESH_KUN,
    user: {
      id: user.id,
      ism: user.ism,
      login: user.login,
      rol: normalizeRol(user.rol),
      mustChangePassword: user.mustChangePassword ?? false,
    },
  });
}
