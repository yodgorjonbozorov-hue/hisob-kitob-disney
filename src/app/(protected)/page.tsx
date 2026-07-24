import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { MonthSelector } from "@/components/MonthSelector";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { DailyDynamicsChart } from "@/components/charts/DailyDynamicsChart";
import { formatMoneyCompact, formatSomLabel } from "@/lib/format";
import { currentMonthString } from "@/lib/date";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import {
  getMonthSummary,
  getCategoryBreakdown,
  getTrend,
  getDailyDynamics,
} from "@/lib/queries/dashboard";
import { getOutstandingDebtTotal } from "@/lib/queries/inventory";

export default async function DashboardPage({
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
        <h1 className="text-2xl font-bold text-fg">Boshqaruv paneli</h1>
        <p className="text-muted">Hali biznes yaratilmagan. Admin panel → Bizneslar bo'limidan qo'shing.</p>
      </div>
    );
  }

  const business = await getActiveBusiness(session);
  const [summary, kirimBreakdown, chiqimBreakdown, trend, daily, qarzTotal] = await Promise.all([
    getMonthSummary(businessId, month),
    getCategoryBreakdown(businessId, month, "kirim"),
    getCategoryBreakdown(businessId, month, "chiqim"),
    getTrend(businessId, 6, month),
    getDailyDynamics(businessId, month),
    business?.omborli ? getOutstandingDebtTotal(businessId) : Promise.resolve(0),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-fg">Boshqaruv paneli</h1>
        <MonthSelector month={month} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Jami kirim"
          value={formatMoneyCompact(summary.jamiKirim)}
          changePct={summary.changePct.kirim}
          goodWhenUp
          accent="income"
        />
        <StatCard
          label="Jami chiqim"
          value={formatMoneyCompact(summary.jamiChiqim)}
          changePct={summary.changePct.chiqim}
          goodWhenUp={false}
          accent="expense"
        />
        <StatCard
          label="Sof foyda"
          value={formatMoneyCompact(summary.sofFoyda)}
          changePct={summary.changePct.sofFoyda}
          goodWhenUp
          accent={summary.sofFoyda >= 0 ? "income" : "expense"}
        />
        <StatCard
          label="Qarzdorlik"
          value={formatMoneyCompact(qarzTotal)}
          accent={qarzTotal > 0 ? "expense" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-semibold text-fg mb-3">Kirim — kategoriya bo'yicha</h2>
          <CategoryPieChart data={kirimBreakdown} emptyLabel="Bu oyda kirim yo'q" />
          <CategoryRanking data={kirimBreakdown} />
        </Card>
        <Card>
          <h2 className="font-semibold text-fg mb-3">Chiqim — kategoriya bo'yicha</h2>
          <CategoryPieChart data={chiqimBreakdown} emptyLabel="Bu oyda chiqim yo'q" />
          <CategoryRanking data={chiqimBreakdown} />
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-fg mb-3">So'nggi 6 oy dinamikasi</h2>
        <TrendChart data={trend} />
      </Card>

      <Card>
        <h2 className="font-semibold text-fg mb-3">Kunlik dinamika (joriy oy)</h2>
        <DailyDynamicsChart data={daily} />
      </Card>
    </div>
  );
}

function CategoryRanking({ data }: { data: { nomi: string; summa: number; foiz: number }[] }) {
  if (data.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {data.map((item, i) => (
        <li key={item.nomi} className="flex items-center justify-between text-sm">
          <span className="text-muted">
            {i + 1}. {item.nomi}
          </span>
          <span className="font-medium text-fg">
            {formatSomLabel(item.summa)} <span className="text-faint">({item.foiz.toFixed(0)}%)</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
