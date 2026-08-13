import { NextRequest, NextResponse } from "next/server";
import { tiklashKodiniYubor } from "@/lib/auth/parolTiklash";
import { parolTiklashSchema } from "@/lib/validation/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";

/**
 * POST /api/auth/parol-tiklash — tiklash kodini Telegramga yuborish (H-7).
 *
 * Javob HAR DOIM bir xil: login mavjudligi, faolligi va Telegram
 * ulanganligini bu endpoint orqali bilib bo'lmaydi (user enumeration yopiq).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  // IP bo'yicha 10/soat — turli loginlarni terib chiqishga qarshi.
  const rlIp = await rateLimit(`ptiklash:ip:${ip}`, 10, 60 * 60 * 1000);
  if (!rlIp.ok) {
    return NextResponse.json(
      { error: `Juda ko'p urinish. ${rlIp.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const parsed = parolTiklashSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Login kiritilishi shart" }, { status: 400 });
  }

  // Login bo'yicha 3/soat — bitta hisobga kod bombardimoni bo'lmasin.
  const rlLogin = await rateLimit(
    `ptiklash:l:${parsed.data.login.toLowerCase()}`,
    3,
    60 * 60 * 1000
  );
  if (!rlLogin.ok) {
    return NextResponse.json(
      { error: `Juda ko'p urinish. ${rlLogin.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  await tiklashKodiniYubor(parsed.data.login);

  // Doim bir xil javob (enumeration yopiq). Telegram ulanmaganlar uchun
  // yo'l-yo'riq ham shu matnda — alohida xabar login mavjudligini oshkor qilardi.
  return NextResponse.json({
    ok: true,
    message:
      "Agar bunday hisob mavjud va Telegramga ulangan bo'lsa, botga 6 raqamli kod yuborildi. " +
      "Kod kelmasa — Telegram ulanmagan: direktoringizga murojaat qiling.",
  });
}
