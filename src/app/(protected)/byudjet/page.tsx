import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getBudgetsWithSpend } from "@/lib/queries/budget";
import { currentMonthString } from "@/lib/date";
import { MonthSelector } from "@/components/MonthSelector";
import { BudjetClient } from "./BudjetClient";

export default async function BudjetPage({ searchParams }: { searchParams: { month?: string } }) {
  const session = await requireUser();
  if (session.rol !== "admin") {
    redirect("/tranzaksiyalar");
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
}
