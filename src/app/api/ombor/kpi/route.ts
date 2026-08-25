import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { omborKpi } from "@/lib/queries/ombor";

/**
 * OMBOR KPI — mobil klient uchun. Veb bu raqamlarni server komponentda
 * (`/app/ombor` sahifasi) oladi; mobil ilova esa HTTP orqali so'raydi.
 * Hisob-kitob (Σ miqdor × kelganNarx) faqat serverda — klient qayta hisoblamaydi.
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) {
      return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    }
    await requireOmborli(businessId);
    return NextResponse.json(await omborKpi(businessId));
  },
  { module: "OMBOR" }
);
