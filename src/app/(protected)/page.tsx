import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { MonthSelector } from "@/components/MonthSelector";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { DailyDynamicsChart } from "@/components/charts/DailyDynamicsChart";
import { formatSomLabel, formatPercent, changeDirection } from "@/lib/format";
import { currentMonthString } from "@/lib/date";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveBusinessId } from "@/lib/business";
import {
  getMonthSummary,
  getCategoryBreakdown,
  getTrend,
  getDailyDynamics,
} from "@/lib/queries/dashboard";

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

  const [summary, kirimBreakdown, chiqimBreakdown, trend, daily] = await Promise.all([
    getMonthSummary(businessId, month),
    getCategoryBreakdown(businessId, month, "kirim"),
    getCategoryBreakdown(businessId, month, "chiqim"),
    getTrend(businessId, 6, month),
    getDailyDynamics(businessId, month),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-fg">Boshqaruv paneli</h1>
        <MonthSelector month={month} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-muted text-sm mb-1">Jami kirim</p>
          <p className="text-2xl font-bold text-income">{formatSomLabel(summary.jamiKirim)}</p>
          <p className={`text-xs mt-1 ${changeDirection(summary.changePct.kirim) === "up" ? "text-income" : changeDirection(summary.changePct.kirim) === "down" ? "text-expense" : "text-faint"}`}>
            O'tgan oyga nisbatan {formatPercent(summary.changePct.kirim)}
          </p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Jami chiqim</p>
          <p className="text-2xl font-bold text-expense">{formatSomLabel(summary.jamiChiqim)}</p>
          <p className={`text-xs mt-1 ${changeDirection(summary.changePct.chiqim) === "up" ? "text-expense" : changeDirection(summary.changePct.chiqim) === "down" ? "text-income" : "text-faint"}`}>
            O'tgan oyga nisbatan {formatPercent(summary.changePct.chiqim)}
          </p>
        </Card>
        <Card className={summary.sofFoyda >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}>
          <p className="text-muted text-sm mb-1">Sof foyda</p>
          <p className={`text-2xl font-bold ${summary.sofFoyda >= 0 ? "text-income" : "text-expense"}`}>
            {formatSomLabel(summary.sofFoyda)}
          </p>
          <p className={`text-xs mt-1 ${changeDirection(summary.changePct.sofFoyda) === "up" ? "text-income" : changeDirection(summary.changePct.sofFoyda) === "down" ? "text-expense" : "text-faint"}`}>
            O'tgan oyga nisbatan {formatPercent(summary.changePct.sofFoyda)}
          </p>
        </Card>
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
