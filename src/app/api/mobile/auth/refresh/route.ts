import { NextRequest, NextResponse } from "next/server";
import { tokenYangila, ACCESS_DAQIQA, REFRESH_KUN } from "@/lib/auth/mobil";
import { mobilRefreshSchema } from "@/lib/validation/mobil";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";

/**
 * TOKENNI YANGILASH (rotatsiya bilan).
 *
 * Har chaqiruv YANGI juftlik beradi va eskisini yopadi. Ishlatilgan refresh
 * qayta kelsa — o'g'irlik: qurilmaning barcha tokenlari bekor qilinadi va
 * 401 `ogirlik` qaytadi. Klient bunda foydalanuvchini qayta login qilishga
 * yo'naltiradi va Keychain'dagi tokenni o'chiradi.
 */
export async function POST(request: NextRequest) {
  // Refresh tokenni taxmin qilib bo'lmaydi (32 bayt), lekin so'rovlar soni
  // baribir cheklanadi — bazani bo'sh urinishlar bilan yuklamaslik uchun.
  const ip = getClientIp(request) ?? "unknown";
  const rl = await rateLimit(`mrefresh:${ip}`, 60, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Juda ko'p so'rov. ${rl.retryAfter} soniyadan keyin urining.` },
      { status: 429 },
    );
  }

  const parsed = mobilRefreshSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "refresh token kerak", kod: "yaroqsiz" }, { status: 400 });
  }

  const natija = await tokenYangila(parsed.data.refresh);

  if (natija.holat === "ogirlik") {
    return NextResponse.json(
      {
        error: "Sessiya xavfsizligi buzilgan — qaytadan kiring.",
        kod: "ogirlik",
      },
      { status: 401 },
    );
  }
  if (natija.holat === "yaroqsiz") {
    return NextResponse.json(
      { error: "Sessiya muddati tugagan — qaytadan kiring.", kod: "yaroqsiz" },
      { status: 401 },
    );
  }

  const { juftlik } = natija;
  return NextResponse.json({
    access: juftlik.access,
    refresh: juftlik.refresh,
    accessExpiresAt: juftlik.accessExpiresAt.toISOString(),
    refreshExpiresAt: juftlik.refreshExpiresAt.toISOString(),
    accessDaqiqa: ACCESS_DAQIQA,
    refreshKun: REFRESH_KUN,
  });
}
