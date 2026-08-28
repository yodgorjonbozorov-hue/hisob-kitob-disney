import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getDavomatHisoboti } from "@/lib/queries/davomat";
import { toshkentSana } from "@/lib/davomat/vaqt";

const SANA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Davr hisoboti: davomat %, kechikishlar, ishlangan soatlar, jarima/bonus. */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const p = new URL(request.url).searchParams;
    const bugun = toshkentSana(new Date());
    const from = SANA_RE.test(p.get("from") ?? "") ? p.get("from")! : bugun;
    const to = SANA_RE.test(p.get("to") ?? "") ? p.get("to")! : bugun;
    return NextResponse.json(await getDavomatHisoboti(businessId, from, to));
  },
  { module: "HR" }
);
