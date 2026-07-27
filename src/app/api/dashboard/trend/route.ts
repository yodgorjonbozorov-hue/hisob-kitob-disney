import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { getTrend, getDailyDynamics } from "@/lib/queries/dashboard";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString } from "@/lib/date";

export const GET = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const granularity = searchParams.get("granularity");

  if (granularity === "day") {
    const month = searchParams.get("month") ?? currentMonthString();
    const daily = await getDailyDynamics(businessId, month);
    return NextResponse.json(daily);
  }

  const months = Math.min(12, Math.max(1, parseInt(searchParams.get("months") ?? "6", 10)));
  const endMonth = searchParams.get("month") ?? currentMonthString();
  const trend = await getTrend(businessId, months, endMonth);
  return NextResponse.json(trend);
});
