import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { getCategoryBreakdown } from "@/lib/queries/dashboard";
import { currentMonthString } from "@/lib/date";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireRole(user.rol, "admin");

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? currentMonthString();
    const turi = searchParams.get("turi") === "chiqim" ? "chiqim" : "kirim";
    const breakdown = await getCategoryBreakdown(month, turi);
    return NextResponse.json(breakdown);
  } catch (error) {
    return handleApiError(error);
  }
}
