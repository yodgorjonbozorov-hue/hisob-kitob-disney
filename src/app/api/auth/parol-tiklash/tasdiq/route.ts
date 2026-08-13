import { NextRequest, NextResponse } from "next/server";
import { tiklashniTasdiqla } from "@/lib/auth/parolTiklash";
import { parolTiklashTasdiqSchema } from "@/lib/validation/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";

/**
 * POST /api/auth/parol-tiklash/tasdiq — kod + yangi parol bilan yakunlash (H-7).
 * Xato sabablari farqlanmaydi (kod noto'g'ri / muddati o'tgan / hisob yo'q).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  // Kod atigi 6 raqam — taxmin qilishga qattiq limit: IP bo'yicha 10/soat.
  const rlIp = await rateLimit(`ptiklasht:ip:${ip}`, 10, 60 * 60 * 1000);
  if (!rlIp.ok) {
    return NextResponse.json(
      { error: `Juda ko'p urinish. ${rlIp.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const parsed = parolTiklashTasdiqSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  // Login bo'yicha ham 5/15 daqiqa — bitta hisob kodini parallel terib bo'lmasin.
  const rlLogin = await rateLimit(
    `ptiklasht:l:${parsed.data.login.toLowerCase()}`,
    5,
    15 * 60 * 1000
  );
  if (!rlLogin.ok) {
    return NextResponse.json(
      { error: `Juda ko'p urinish. ${rlLogin.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const ok = await tiklashniTasdiqla(parsed.data.login, parsed.data.kod, parsed.data.parol);
  if (!ok) {
    return NextResponse.json(
      { error: "Kod noto'g'ri yoki muddati o'tgan. Qaytadan kod so'rang." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, message: "Parol yangilandi — endi yangi parol bilan kiring." });
}
