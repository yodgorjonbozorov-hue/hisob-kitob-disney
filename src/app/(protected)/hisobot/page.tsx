import { redirect } from "next/navigation";
import { getMonthlyReport } from "@/lib/queries/report";
import { currentMonthString } from "@/lib/date";
import { MonthSelector } from "@/components/MonthSelector";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { ReportView } from "./ReportView";

export default async function HisobotPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  if (!isManager(session.rol)) {
    redirect("/tranzaksiyalar");
  }
  const businessId = await resolveActiveBusinessId(session);
  const month = searchParams.month ?? currentMonthString();

  if (!businessId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-fg">Oylik hisobot</h1>
        <p className="text-muted">Hali biznes yaratilmagan.</p>
      </div>
    );
  }

  const report = await getMonthlyReport(businessId, month);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-fg">Oylik hisobot</h1>
        <MonthSelector month={month} />
      </div>
      <ReportView report={report} />
    </div>
  );
  });
}
