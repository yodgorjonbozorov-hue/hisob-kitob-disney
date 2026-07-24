import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { z } from "zod";

const schema = z.object({
  eski: z.string().min(1, "Eski parol kiritilishi shart"),
  yangi: z.string().min(6, "Yangi parol kamida 6 belgi bo'lishi kerak").max(100),
});

/** Foydalanuvchi o'z parolini o'zgartiradi (eski parolni tasdiqlab). */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
  }

  const valid = await verifyPassword(parsed.data.eski, user.parolHash);
  if (!valid) {
    return NextResponse.json({ error: "Eski parol noto'g'ri" }, { status: 400 });
  }

  if (parsed.data.yangi === parsed.data.eski) {
    return NextResponse.json({ error: "Yangi parol eskisidan farq qilishi kerak" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { parolHash: await hashPassword(parsed.data.yangi), mustChangePassword: false },
  });

  session.mustChangePassword = false;
  await session.save();

  return NextResponse.json({ ok: true });
}
