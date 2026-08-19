import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { forbidSeller } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireMagazin } from "@/lib/business";
import { kodQidirSchema } from "@/lib/validation/pos";
import { kodBoyichaMahsulot } from "@/lib/services/mahsulotKod";

/**
 * SKANERLANGAN KOD -> MAHSULOT.
 *
 * Skaner (HID klaviatura), kamera va qo'lda kiritish — uchalasi ham shu
 * endpoint'ga keladi.
 *
 * XAVFSIZLIK: shtrix-kod butun mamlakat bo'ylab bir xil ("Coca-Cola 1.5L"
 * hamma do'konda 4601234567890). Shu bois qidiruv AKTIV BIZNES bilan qattiq
 * cheklanadi (`kodBoyichaMahsulot` ichida `businessId` sharti) — boshqa
 * kompaniyaning mahsuloti hech qachon qaytmaydi.
 *
 * POST (GET emas): kod so'rov manzilida qolib, brauzer tarixi va server
 * loglariga tushmasligi uchun.
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    forbidSeller(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireMagazin(businessId);

    const parsed = kodQidirSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const mahsulot = await kodBoyichaMahsulot(businessId, parsed.data.kod);
    if (!mahsulot) {
      return NextResponse.json({ topildi: false }, { status: 200 });
    }
    return NextResponse.json({ topildi: true, mahsulot });
  },
  { module: "MAGAZIN" }
);
