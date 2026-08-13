import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { RUXSAT_MIME } from "@/lib/storage/driver";

/**
 * FAYL PROKSISI (H-9): yuklangan (blob) ilova fayllari OCHIQ Blob URL
 * orqali emas, shu route orqali beriladi — withTenant + egalik tekshiruvi
 * bilan. Blob URL bazada qoladi, lekin frontendga chiqmaydi: havolani
 * bilgan begona odam moliyaviy hujjatni ocholmaydi.
 *
 * Yumshoq o'chirilgan ilova 404 qaytaradi. Tashqi "havola" rejimidagi
 * ilovalar bu yerdan berilmaydi — ular frontendda to'g'ridan ochiladi.
 */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const ilova = await prisma.attachment.findFirst({
      where: { id: params.id, businessId, deletedAt: null },
    });
    if (!ilova || ilova.saqlagich !== "blob") {
      return NextResponse.json({ error: "Fayl topilmadi" }, { status: 404 });
    }

    const res = await fetch(ilova.url);
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: "Faylni saqlagichdan olib bo'lmadi" }, { status: 502 });
    }

    // MIME faqat ruxsat ro'yxatidan — brauzer yot narsani ijro etmasin.
    const mime = (RUXSAT_MIME as readonly string[]).includes(ilova.mimeType ?? "")
      ? ilova.mimeType!
      : "application/octet-stream";
    const nom = encodeURIComponent(ilova.nomi.replace(/["\r\n]/g, "_"));

    return new Response(res.body, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${nom}`,
        "Cache-Control": "private, no-store",
        ...(ilova.hajm ? { "Content-Length": String(ilova.hajm) } : {}),
      },
    });
  },
  { module: "HUJJATLAR" }
);
