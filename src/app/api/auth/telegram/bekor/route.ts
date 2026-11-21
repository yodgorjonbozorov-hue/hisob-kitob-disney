import { NextRequest, NextResponse } from "next/server";
import { bekorQilish } from "@/lib/auth/telegramLogin";
import { telegramTokenSchema } from "@/lib/validation/auth";
import { TG_NONCE_COOKIE, nonceOchir } from "../cookie";

/** Foydalanuvchi kutishni bekor qildi — botdagi tasdiq tugmasi endi ishlamaydi. */
export async function POST(request: NextRequest) {
  const parsed = telegramTokenSchema.safeParse(await request.json().catch(() => null));
  if (parsed.success) {
    await bekorQilish(parsed.data.token, request.cookies.get(TG_NONCE_COOKIE)?.value);
  }
  const res = NextResponse.json({ ok: true });
  nonceOchir(res);
  return res;
}
