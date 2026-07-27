import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getBudgetsWithSpend } from "@/lib/queries/budget";
import { currentMonthString } from "@/lib/date";
import { MonthSelector } from "@/components/MonthSelector";
import { BudjetClient } from "./BudjetClient";

export default async function BudjetPage({ searchParams }: { searchParams: { month?: string } }) {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  if (!isManager(session.rol)) {
    redirect("/app/tranzaksiyalar");
  }
  const businessId = await resolveActiveBusinessId(session);
  const business = await getActiveBusiness(session);
  const month = searchParams.month ?? currentMonthString();

  const rows = businessId ? await getBudgetsWithSpend(businessId, month) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">Budjet</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Kategoriya bo'yicha
            oylik xarajat limiti
          </p>
        </div>
        <MonthSelector month={month} />
      </div>
      <BudjetClient rows={rows} month={month} />
    </div>
  );
  });
}
