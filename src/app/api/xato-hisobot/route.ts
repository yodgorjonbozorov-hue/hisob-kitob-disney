import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rateLimit";
import { xatoniYubor } from "@/lib/monitoring/xabar";

/**
 * CLIENT XATO HISOBOTI (TASK 3.3) — error boundary'da ushlangan brauzer
 * xatolari monitoring'ga yetib borishi uchun. Faqat tizimga kirgan
 * foydalanuvchidan qabul qilinadi va qattiq rate limit ostida — ochiq
 * spam kanaliga aylanmasin.
 */
const schema = z.object({
  xabar: z.string().trim().min(1).max(500),
  digest: z.string().max(100).optional().nullable(),
  url: z.string().max(300).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const rl = await rateLimit(`xatoh:${user.userId}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  await xatoniYubor(new Error(parsed.data.xabar), "client:boundary", {
    digest: parsed.data.digest ?? null,
    url: parsed.data.url ?? null,
    userId: user.userId,
  });
  return NextResponse.json({ ok: true });
}
