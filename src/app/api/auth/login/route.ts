import { NextRequest, NextResponse } from "next/server";
// Login global (tenantlar aro) unique — autentifikatsiya rawPrisma bilan ishlaydi.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import { Prisma } from "@prisma/client";
import { registrsizTeng } from "@/lib/db/dialect";
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

  // Registrsiz taqqoslash provayderga bog'liq (SQLite: COLLATE NOCASE,
  // Postgres: LOWER() + funksional indeks) — `lib/db/dialect.ts` da.
  const matches = await prisma.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "User" WHERE ${registrsizTeng('"login"', login)} LIMIT 2`
  );
  if (matches.length !== 1) return null;
  return prisma.user.findUnique({ where: { id: matches[0].id } });
}

/** Rate limit oynalari — reset ham xuddi shu oyna kaliti bilan ishlashi kerak. */
const IP_OYNA = 5 * 60 * 1000;
const LOGIN_OYNA = 15 * 60 * 1000;

/**
 * Kirish urinishini audit jurnaliga yozadi. HECH QACHON xato tashlamaydi —
 * jurnal yozib bo'lmagani login oqimini buzmasligi kerak.
 */
async function loginUrinishiYoz(p: {
  login: string;
  ip: string;
  ok: boolean;
  userId: string | null;
  tenantId: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: p.tenantId,
        businessId: null,
        userId: p.userId,
        userIsm: p.login,
        action: p.ok ? "login" : "login_failed",
        entity: "auth",
        entityId: p.userId ?? p.login,
        ip: p.ip === "unknown" ? null : p.ip,
      },
    });
  } catch (error) {
    console.error("Kirish urinishini yozib bo'lmadi:", error);
  }
}

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
    // Muvaffaqiyatsiz urinish jurnalga tushadi — Xavfsizlik markazi shu
    // yozuvlardan hujum belgisini ko'radi (Superadmin 2.0, talab 24).
    // Yozuvlar soni rate limit bilan cheklangan (IP 8/5daq, login 5/15daq).
    await loginUrinishiYoz({ login, ip, ok: false, userId: user?.id ?? null, tenantId: user?.tenantId ?? null });
    return genericError;
  }

  const valid = await verifyPassword(parol, user.parolHash);
  if (!valid) {
    await loginUrinishiYoz({ login, ip, ok: false, userId: user.id, tenantId: user.tenantId });
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
  session.sessionEpoch = user.sessionEpoch ?? 0;
  await session.save();

  await loginUrinishiYoz({ login, ip, ok: true, userId: user.id, tenantId: user.tenantId });

  return NextResponse.json({ ok: true, rol: user.rol, mustChangePassword: user.mustChangePassword ?? false });
}
