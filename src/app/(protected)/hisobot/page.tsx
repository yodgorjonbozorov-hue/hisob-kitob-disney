import { redirect } from "next/navigation";
import { getMonthlyReport } from "@/lib/queries/report";
import { currentMonthString } from "@/lib/date";
import { MonthSelector } from "@/components/MonthSelector";
import { requireUser } from "@/lib/auth/session";
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
  const month = searchParams.month ?? currentMonthString();
  const report = await getMonthlyReport(month);

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
