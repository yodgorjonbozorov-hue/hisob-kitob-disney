import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { getMonthlyReport } from "@/lib/queries/report";
import { currentMonthString } from "@/lib/date";
import { MonthlyReportDocument } from "@/lib/pdf/MonthlyReportDocument";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireRole(user.rol, "admin");

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? currentMonthString();
    const report = await getMonthlyReport(month);

    const buffer = await renderToBuffer(MonthlyReportDocument({ report }));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hisobot-${month}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
