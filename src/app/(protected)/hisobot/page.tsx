import { redirect } from "next/navigation";
import { getMonthlyReport } from "@/lib/queries/report";
import { currentMonthString } from "@/lib/date";
import { MonthSelector } from "@/components/MonthSelector";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveBusinessId } from "@/lib/business";
import { ReportView } from "./ReportView";

export default async function HisobotPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const session = await requireUser();
  if (session.rol !== "admin") {
    redirect("/tranzaksiyalar");
  }
  const businessId = await resolveActiveBusinessId(session);
  const month = searchParams.month ?? currentMonthString();

  if (!businessId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Oylik hisobot</h1>
        <p className="text-slate-500">Hali biznes yaratilmagan.</p>
      </div>
    );
  }

  const report = await getMonthlyReport(businessId, month);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Oylik hisobot</h1>
        <MonthSelector month={month} />
      </div>
      <ReportView report={report} />
    </div>
  );
}
