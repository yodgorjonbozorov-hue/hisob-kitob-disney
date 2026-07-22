import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { getTrend, getDailyDynamics } from "@/lib/queries/dashboard";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString } from "@/lib/date";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireRole(user.rol, "admin");

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
  } catch (error) {
    return handleApiError(error);
  }
}
