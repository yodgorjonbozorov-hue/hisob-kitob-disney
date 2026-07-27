import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { getMonthSummary } from "@/lib/queries/dashboard";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString } from "@/lib/date";

export const GET = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? currentMonthString();
  const summary = await getMonthSummary(businessId, month);
  return NextResponse.json(summary);
});
