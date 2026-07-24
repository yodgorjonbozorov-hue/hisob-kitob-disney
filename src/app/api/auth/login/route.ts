import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { getSession, type Rol } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Login yoki parol noto'g'ri" }, { status: 400 });
  }

  const { login, parol } = parsed.data;
  const genericError = NextResponse.json(
    { error: "Login yoki parol noto'g'ri" },
    { status: 401 }
  );

  const user = await prisma.user.findUnique({ where: { login } });
  if (!user || !user.isActive) {
    return genericError;
  }

  const valid = await verifyPassword(parol, user.parolHash);
  if (!valid) {
    return genericError;
  }

  const session = await getSession();
  session.userId = user.id;
  session.login = user.login;
  session.ism = user.ism;
  session.rol = user.rol as Rol;
  session.businessId = user.businessId ?? null;
  await session.save();

  return NextResponse.json({ ok: true, rol: user.rol });
}
