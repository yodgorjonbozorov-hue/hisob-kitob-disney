import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { getMonthlyReport } from "@/lib/queries/report";
import { currentMonthString } from "@/lib/date";
import { buildMonthlyReportWorkbook } from "@/lib/excel/monthlyReportWorkbook";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireRole(user.rol, "admin");

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? currentMonthString();
    const report = await getMonthlyReport(month);
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
