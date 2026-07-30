import { NextRequest, NextResponse } from "next/server";
import { demoRequestSchema } from "@/lib/validation/demo";
import { createDemoRequest } from "@/lib/services/demoRequest";
import { normalizePhone } from "@/lib/validation/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/services/audit";

/**
 * Ochiq (autentifikatsiyasiz) demo so'rovi. Kompaniya YARATMAYDI —
 * faqat DemoRequest yozuvini qoldiradi; kompaniyani superadmin qo'lda ochadi.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  // Bir IP dan soatiga 5 ta so'rov.
  const rl = rateLimit(`demo:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Juda ko'p urinish. ${rl.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = demoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const telefon = normalizePhone(parsed.data.telefon);
  if (telefon.replace("+", "").length < 9) {
    return NextResponse.json({ error: "Telefon raqam noto'g'ri" }, { status: 400 });
  }

  await createDemoRequest({ ...parsed.data, telefon });

  return NextResponse.json({ ok: true }, { status: 201 });
}
