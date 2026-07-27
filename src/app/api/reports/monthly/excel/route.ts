import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { getMonthlyReport } from "@/lib/queries/report";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString } from "@/lib/date";
import { buildMonthlyReportWorkbook } from "@/lib/excel/monthlyReportWorkbook";

export const GET = withTenant(async (request, _ctx, { session: user }) => {
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
});
