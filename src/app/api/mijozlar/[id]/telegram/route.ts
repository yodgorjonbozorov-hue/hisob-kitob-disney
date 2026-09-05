import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { ulanishTokeniYarat, telegramniUz } from "@/lib/services/mijozTelegram";
import { mijozTelegramHolati } from "@/lib/queries/mijozTelegram";

/**
 * MIJOZNI TELEGRAMGA ULASH HAVOLASI.
 *
 * GET    — joriy holat ("✅ Ulangan" / "⚪ Ulanmagan");
 * POST   — yangi bir martalik havola + QR (sotuvchi mijozga ko'rsatadi);
 * DELETE — ulanishni uzish.
 *
 * ROL: havola yaratish SOTUVCHIGA ham ochiq — u mijoz bilan yuzma-yuz
 * turadi va QR'ni aynan o'sha ko'rsatadi. Havola hech qanday ma'lumot
 * OCHMAYDI: u faqat mijozning O'Z kartochkasiga ulanish imkonini beradi.
 */

export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const holat = await mijozTelegramHolati(businessId, params.id);
    if (!holat) return NextResponse.json({ error: "Mijoz topilmadi" }, { status: 404 });
    return NextResponse.json(holat);
  },
  { module: "MIJOZLAR" }
);

export const POST = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const natija = await ulanishTokeniYarat(businessId, params.id);

    // QR faqat havola bo'lganda: bot username sozlanmagan bo'lsa mijozga
    // ko'rsatadigan narsa yo'q va UI shuni aytadi.
    const qr = natija.havola
      ? await QRCode.toDataURL(natija.havola, { width: 320, margin: 1 })
      : null;

    return NextResponse.json({ ...natija, qr });
  },
  { module: "MIJOZLAR" }
);

export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    await telegramniUz(businessId, params.id);
    return NextResponse.json({ ok: true });
  },
  { module: "MIJOZLAR" }
);
