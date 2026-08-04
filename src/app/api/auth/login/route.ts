import { NextRequest, NextResponse } from "next/server";
// Login global (tenantlar aro) unique — autentifikatsiya rawPrisma bilan ishlaydi.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { normalizeRol } from "@/lib/auth/roles";
import { loginSchema } from "@/lib/validation/auth";
import { rateLimit, rateLimitReset } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";

/**
 * Loginni topadi: avval aniq moslik, topilmasa registr (katta/kichik harf)
 * e'tiborga olinmagan holda. Mobil klaviaturalar birinchi harfni avtomatik
 * kattalashtiradi ("superadmin" -> "Superadmin"), SQLite esa registrga sezgir.
 *
 * Xavfsizlik: registrsiz moslik FAQAT bitta foydalanuvchi topilgandagina
 * qabul qilinadi — "Admin"/"admin" kabi ikki xil akkaunt bo'lsa hech biri
 * tanlanmaydi (noto'g'ri akkauntga kirib qolishning oldi olinadi).
 */
async function findUserByLogin(login: string) {
  const exact = await prisma.user.findUnique({ where: { login } });
  if (exact) return exact;

  const matches = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE "login" = ${login} COLLATE NOCASE LIMIT 2
  `;
  if (matches.length !== 1) return null;
  return prisma.user.findUnique({ where: { id: matches[0].id } });
}

/** Rate limit oynalari — reset ham xuddi shu oyna kaliti bilan ishlashi kerak. */
const IP_OYNA = 5 * 60 * 1000;
const LOGIN_OYNA = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  const rlKey = `login:${ip}`;
  // Har IP uchun 5 daqiqada 8 urinish (hisoblagich bazada — barcha lambda
  // instansiyalari uchun umumiy).
  const rl = await rateLimit(rlKey, 8, IP_OYNA);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Juda ko'p urinish. ${rl.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Login yoki parol noto'g'ri" }, { status: 400 });
  }

  const { login, parol } = parsed.data;

  // Bir login bo'yicha ham alohida limit (IP almashtirib brute-force qilishga qarshi):
  // 15 daqiqada 5 urinish.
  const rlLoginKey = `login:l:${login.toLowerCase()}`;
  const rlLogin = await rateLimit(rlLoginKey, 5, LOGIN_OYNA);
  if (!rlLogin.ok) {
    return NextResponse.json(
      { error: `Bu login uchun juda ko'p urinish. ${rlLogin.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const genericError = NextResponse.json({ error: "Login yoki parol noto'g'ri" }, { status: 401 });

  const user = await findUserByLogin(login);
  if (!user || !user.isActive) {
    return genericError;
  }

  const valid = await verifyPassword(parol, user.parolHash);
  if (!valid) {
    return genericError;
  }

  // Muvaffaqiyat — rate limitlarni tozalaymiz va oxirgi kirish vaqtini yozamiz.
  await rateLimitReset(rlKey, IP_OYNA);
  await rateLimitReset(rlLoginKey, LOGIN_OYNA);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

  const session = await getSession();
  session.userId = user.id;
  session.login = user.login;
  session.ism = user.ism;
  session.rol = normalizeRol(user.rol);
  session.tenantId = user.tenantId ?? null;
  session.businessId = user.businessId ?? null;
  session.mustChangePassword = user.mustChangePassword ?? false;
  await session.save();

  return NextResponse.json({ ok: true, rol: user.rol, mustChangePassword: user.mustChangePassword ?? false });
}
