import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { getMonthSummary } from "@/lib/queries/dashboard";
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
    const month = searchParams.get("month") ?? currentMonthString();
    const summary = await getMonthSummary(businessId, month);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
