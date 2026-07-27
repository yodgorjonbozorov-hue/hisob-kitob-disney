import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { getMonthlyReport } from "@/lib/queries/report";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString } from "@/lib/date";
import { MonthlyReportDocument } from "@/lib/pdf/MonthlyReportDocument";

export const GET = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? currentMonthString();
  const report = await getMonthlyReport(businessId, month);

  const buffer = await renderToBuffer(MonthlyReportDocument({ report }));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="hisobot-${month}.pdf"`,
    },
  });
});
