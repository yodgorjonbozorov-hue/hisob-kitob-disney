import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireMagazin } from "@/lib/business";
import { qrKodHammasiga } from "@/lib/services/mahsulotKod";

/**
 * Kodsiz tovarlarning HAMMASIGA Balansa QR yaratish.
 *
 * Katalogni o'zgartiradi — boshqaruvchi amali (bitta mahsulotga QR yaratish
 * bilan bir xil qoida). Idempotent: kodi borlar tegilmaydi.
 */
export const POST = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireMagazin(businessId);

    return NextResponse.json({ ok: true, ...(await qrKodHammasiga({ businessId })) });
  },
  { module: "MAGAZIN" }
);
