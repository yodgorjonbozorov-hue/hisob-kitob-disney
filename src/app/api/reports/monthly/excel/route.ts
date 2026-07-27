import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireManager, UnauthorizedError } from "@/lib/auth/guard";
import { getMonthlyReport } from "@/lib/queries/report";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString } from "@/lib/date";
import { buildMonthlyReportWorkbook } from "@/lib/excel/monthlyReportWorkbook";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? currentMonthString();
    const report = await getMonthlyReport(businessId, month);
    const buffer = await buildMonthlyReportWorkbook(report);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="hisobot-${month}.xlsx"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
