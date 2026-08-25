import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { sotuvStatistikaSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { getSotuvStatistika, boshSotuvStatistika } from "@/lib/queries/sotuvStatistika";
import { todayTashkentDateOnlyString } from "@/lib/date";

/**
 * SOTILGAN MAHSULOTLAR STATISTIKASI (Kirim bo'limidagi blok).
 *
 * Sahifa birinchi yuklanganda ma'lumot serverdan keladi — bu yo'l faqat
 * sana filtri ALMASHTIRILGANDA chaqiriladi, shuning uchun butun sahifa
 * qayta yuklanmaydi.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const { searchParams } = new URL(request.url);
  const bugun = todayTashkentDateOnlyString();
  const parsed = sotuvStatistikaSchema.safeParse({
    from: searchParams.get("from") ?? bugun,
    to: searchParams.get("to") ?? bugun,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) {
    return NextResponse.json(boshSotuvStatistika(parsed.data.from, parsed.data.to));
  }
  await requireOmborli(businessId);

  return NextResponse.json(await getSotuvStatistika(businessId, parsed.data));
}, { module: "OMBOR" });
