import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { getProvider } from "@/lib/billing/provider";
import { planByCode, PLANLAR } from "@/lib/billing/plans";

/**
 * To'lovni boshlash. Hozircha faqat MANUAL provider: PENDING Payment yaratiladi,
 * mijozga ko'rsatma qaytadi; SUPERADMIN tasdiqlagach obuna uzayadi.
 * `billing: true` — obuna tugagan/bloklangan tenant ham to'lov qila olishi kerak.
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);

    const body = await request.json().catch(() => ({}));
    const planCode = typeof body?.plan === "string" ? body.plan : PLANLAR[0].code;
    if (!planByCode(planCode)) {
      return NextResponse.json({ error: "Noma'lum tarif" }, { status: 400 });
    }

    const provider = getProvider("MANUAL");
    const result = await provider.initiateCheckout({ planCode });

    return NextResponse.json(result, { status: 201 });
  },
  { billing: true }
);
