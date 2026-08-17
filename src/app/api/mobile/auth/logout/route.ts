import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { accessTokenSessiya, bearerToken, qurilmaniBekorQil } from "@/lib/auth/mobil";

/**
 * CHIQISH — faqat SHU qurilmaning tokenlari bekor qilinadi.
 *
 * Boshqa qurilmalar (planshet, ikkinchi telefon) tegilmaydi — foydalanuvchi
 * bitta joydan chiqqani uchun hamma joydan chiqib qolmasin.
 *
 * `withTenant` ishlatilmaydi: chiqish obuna holati yoki modul ruxsatiga
 * bog'liq emas — token yaroqli bo'lsa yetarli.
 */
export async function POST() {
  const token = bearerToken((await headers()).get("authorization"));
  if (!token) {
    return NextResponse.json({ error: "Token yo'q" }, { status: 401 });
  }

  const sessiya = await accessTokenSessiya(token);
  // Token allaqachon yaroqsiz bo'lsa ham `ok` qaytaramiz: klient uchun
  // natija bir xil — u tokenni o'chiradi. Xato ko'rsatishning ma'nosi yo'q.
  if (!sessiya) return NextResponse.json({ ok: true });

  await qurilmaniBekorQil(sessiya.userId, sessiya.deviceId);
  return NextResponse.json({ ok: true });
}
