import { withSuperadmin } from "@/lib/auth/superadmin";
import { NextResponse } from "next/server";
import { r } from "@/lib/superadmin/rbac";
import { eksportQil } from "@/lib/superadmin/eksport";
import { eksportSchema } from "@/lib/validation/superadmin";
import { superadminAudit, SA_AMAL } from "@/lib/superadmin/audit";

/**
 * CSV eksport.
 *
 * POST (GET emas) ATAYLAB: eksport SABAB talab qiladi va auditga tushadi,
 * ya'ni bu o'qish emas, IMTIYOZLI AMAL. GET bo'lganda uni oddiy havola bilan
 * chaqirib yuborish mumkin bo'lardi (CSRF va tasodifiy chiqarish xavfi).
 */
export const POST = withSuperadmin(r("eksport", "VIEW"), async (request, _ctx, sa) => {
  const parsed = eksportSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  // Audit eksportini alohida `audit.VIEW` huquqi ham talab qiladi.
  const natija = await eksportQil(parsed.data.turi);

  await superadminAudit({
    sa,
    amal: SA_AMAL.DATA_EXPORT,
    entity: "export",
    entityId: parsed.data.turi,
    after: { turi: parsed.data.turi, qatorSoni: natija.qatorSoni, fayl: natija.faylNomi },
    sabab: parsed.data.sabab,
  });

  return new Response(natija.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${natija.faylNomi}"`,
      "Cache-Control": "no-store",
    },
  });
});
