import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId } from "@/lib/business";
import { getQarzTafsilot } from "@/lib/queries/qarz";

/** Qarz tafsiloti — to'lovlar tarixi bilan birga. */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    forbidSeller(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const qarz = await getQarzTafsilot(businessId, params.id);
    if (!qarz) return NextResponse.json({ error: "Qarz topilmadi" }, { status: 404 });
    return NextResponse.json(qarz);
  }
);
