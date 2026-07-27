import { NextRequest, NextResponse } from "next/server";
// Login global (tenantlar aro) unique — autentifikatsiya rawPrisma bilan ishlaydi.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { normalizeRol } from "@/lib/auth/roles";
import { loginSchema } from "@/lib/validation/auth";
import { rateLimit, rateLimitReset } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  const rlKey = `login:${ip}`;
  // Har IP uchun 5 daqiqada 8 urinish.
  const rl = rateLimit(rlKey, 8, 5 * 60 * 1000);
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
  const rlLogin = rateLimit(rlLoginKey, 5, 15 * 60 * 1000);
  if (!rlLogin.ok) {
    return NextResponse.json(
      { error: `Bu login uchun juda ko'p urinish. ${rlLogin.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const genericError = NextResponse.json({ error: "Login yoki parol noto'g'ri" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { login } });
  if (!user || !user.isActive) {
    return genericError;
  }

  const valid = await verifyPassword(parol, user.parolHash);
  if (!valid) {
    return genericError;
  }

  // Muvaffaqiyat — rate limitlarni tozalaymiz va oxirgi kirish vaqtini yozamiz.
  rateLimitReset(rlKey);
  rateLimitReset(rlLoginKey);
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
