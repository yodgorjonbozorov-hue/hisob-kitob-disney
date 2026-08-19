import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireMagazin } from "@/lib/business";
import { kodQidirSchema } from "@/lib/validation/pos";
import { qrSvg } from "@/lib/magazin/kod";
import { barcodeSvg, code128Mumkinmi } from "@/lib/magazin/code128";

/**
 * KOD RASMI — QR yoki shtrix-kodning SVG ko'rinishi.
 *
 * Nega serverda chiziladi: chizish jadval bo'yicha to'rtburchak yasashdan
 * iborat va uni brauzerga yuborish qo'shimcha JS yuklashni talab qilardi.
 * SVG (rastr emas) — chop etishda chiziq chetlari aniq qoladi, bu skaner
 * uchun hal qiluvchi.
 *
 * PNG'ga o'girish mijozda (canvas) bajariladi — server tomonda rastr
 * kutubxonasi kerak bo'lmaydi.
 */
export const POST = withTenant<unknown>(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireMagazin(businessId);

    const body = await request.json();
    const parsed = kodQidirSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    const turi = body?.turi === "barcode" ? "barcode" : "qr";
    const kod = parsed.data.kod;

    if (turi === "barcode") {
      if (!code128Mumkinmi(kod)) {
        return NextResponse.json(
          { error: "Bu kodda shtrix-kodga yaramaydigan belgilar bor" },
          { status: 400 }
        );
      }
      return NextResponse.json({ svg: barcodeSvg(kod) });
    }
    return NextResponse.json({ svg: qrSvg(kod) });
  },
  { module: "MAGAZIN" }
);
