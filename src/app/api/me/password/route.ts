import { NextRequest, NextResponse } from "next/server";
// Self-service: faqat sessiyadagi o'z userId bilan ishlaydi — rawPrisma xavfsiz.
import { rawPrisma as prisma } from "@/lib/db/rawPrisma";
import { getSession } from "@/lib/auth/session";
import { sorovEgasi } from "@/lib/auth/tenant";
import { hammaQurilmalarniBekorQil } from "@/lib/auth/mobil";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { z } from "zod";

const schema = z.object({
  eski: z.string().min(1, "Eski parol kiritilishi shart"),
  yangi: z.string().min(8, "Yangi parol kamida 8 belgi bo'lishi kerak").max(100),
});

/** Foydalanuvchi o'z parolini o'zgartiradi (eski parolni tasdiqlab). */
export async function PATCH(request: NextRequest) {
  // Veb cookie sessiyasi YOKI mobil Bearer tokeni — ikkalasi ham qabul qilinadi.
  const egasi = await sorovEgasi();
  if (!egasi) {
    return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: egasi.userId } });
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

  // Parol o'zgardi — BARCHA mobil qurilmalar bekor qilinadi. Sabab: parolni
  // o'zgartirishning odatiy sababi "kimdir kirdi" degan shubha; eski
  // qurilmalarda token 30 kun ishlab tursa bu himoya ma'nosini yo'qotadi.
  await hammaQurilmalarniBekorQil(user.id);

  // Cookie sessiyasi faqat vebda bor — mobil so'rovda uni yangilash shart emas.
  const cookieSessiya = await getSession();
  if (cookieSessiya.userId) {
    cookieSessiya.mustChangePassword = false;
    await cookieSessiya.save();
  }

  return NextResponse.json({ ok: true });
}
