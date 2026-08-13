import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { MonthSelector } from "@/components/MonthSelector";
import { CategoryBars } from "@/components/charts/CategoryBars";
import { TrendChart } from "@/components/charts/TrendChart";
import { DailyDynamicsChart } from "@/components/charts/DailyDynamicsChart";
import { formatMoneyCompact } from "@/lib/format";
import { currentMonthString, todayTashkentDateOnlyString } from "@/lib/date";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
// Dashboard raqamlari 60 soniya keshlanadi; yozuv o'zgarganda kesh darhol
// bekor qilinadi (lib/cache.ts -> dashboardYangilandi).
import {
  getMonthSummaryKesh,
  getCategoryBreakdownKesh,
  getTrendKesh,
  getDailyDynamicsKesh,
} from "@/lib/queries/dashboardCached";
import { getDebtTotals } from "@/lib/queries/inventory";
import { getJamiKassaQoldiq } from "@/lib/queries/accounts";
import { getTodayTotals } from "@/lib/queries/shift";
import { listTransactions } from "@/lib/queries/transactions";
import { KassaHome } from "./KassaHome";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {

  // Kassir/sotuvchi — dashboard EMAS, kassa bosh ekrani (REDESIGN.md 5.1).
  if (!isManager(session.rol)) {
    const bId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!bId) {
      return (
        <div className="max-w-lg mx-auto">
          <p className="text-muted">Sizga biznes biriktirilmagan. Admin bilan bog'laning.</p>
        </div>
      );
    }
    const today = todayTashkentDateOnlyString();
    // Kassir/sotuvchi ekrani — bugungi jami ham, lenta ham faqat o'z yozuvlaridan.
    const scopeUserId = transactionScopeUserId(session);
    const [bugun, recentRes] = await Promise.all([
      getTodayTotals(bId, today, scopeUserId),
      listTransactions({ businessId: bId, userId: scopeUserId, page: 1, pageSize: 12 }),
    ]);
    const recent = recentRes.items.map((t) => ({
      id: t.id,
      sana: t.sana instanceof Date ? t.sana.toISOString() : String(t.sana),
      turi: t.turi,
      summa: t.summa,
      categoryNomi: t.category.nomi,
      izoh: t.izoh,
      userIsm: t.user.ism,
    }));
    return (
      <KassaHome
        ism={session.ism}
        rol={session.rol}
        businessNomi={business?.nomi ?? "—"}
        bugun={bugun}
        recent={recent}
      />
    );
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
  const [summary, kirimBreakdown, chiqimBreakdown, trend, daily, qarzTotal, categoryCount, kassaQoldiq] = await Promise.all([
    getMonthSummaryKesh(businessId, month),
    getCategoryBreakdownKesh(businessId, month, "kirim"),
    getCategoryBreakdownKesh(businessId, month, "chiqim"),
    getTrendKesh(businessId, 6, month),
    getDailyDynamicsKesh(businessId, month),
    business?.omborli ? getDebtTotals(businessId) : Promise.resolve({ olinadigan: 0, beriladigan: 0, sof: 0 }),
    prisma.category.count({ where: { businessId } }),
    getJamiKassaQoldiq(businessId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-fg">Boshqaruv paneli</h1>
        <MonthSelector month={month} />
      </div>

      {categoryCount === 0 && (
        <Card className="border-brand/40 bg-income-soft/30">
          <h2 className="font-semibold text-fg mb-1">Boshlashga tayyormisiz? 🚀</h2>
          <p className="text-sm text-muted mb-3">
            Bu biznes hali bo'sh. Ikki qadamda ishni boshlang:
          </p>
          <ol className="text-sm text-fg space-y-2">
            <li>
              1.{" "}
              <Link href="/app/admin/kategoriyalar" className="text-brand font-medium hover:underline">
                Kategoriya qo'shing
              </Link>{" "}
              (masalan: Sotuv, Ijara, Oylik)
            </li>
            <li>
              2.{" "}
              <Link href="/app/tranzaksiyalar" className="text-brand font-medium hover:underline">
                Birinchi tranzaksiyani kiriting
              </Link>
            </li>
          </ol>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Kassa qoldig'i"
          value={formatMoneyCompact(kassaQoldiq)}
          accent={kassaQoldiq >= 0 ? "brand" : "expense"}
        >
          <Link href="/app/kassa" className="text-2xs text-brand hover:underline mt-1 inline-block">
            Kassalar bo&apos;yicha &rarr;
          </Link>
        </StatCard>
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
          label="Menga qarzdor"
          value={formatMoneyCompact(qarzTotal.olinadigan)}
          accent={qarzTotal.olinadigan > 0 ? "expense" : "neutral"}
        >
          {qarzTotal.beriladigan > 0 && (
            <p className="text-2xs mt-1 tnum text-muted">
              Men qarzdorman:{" "}
              <span className="font-medium text-expense">{formatMoneyCompact(qarzTotal.beriladigan)}</span>
            </p>
          )}
        </StatCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-medium text-fg mb-4">Kirim — kategoriya bo'yicha</h2>
          <CategoryBars data={kirimBreakdown} emptyLabel="Bu oyda kirim yo'q" />
        </Card>
        <Card>
          <h2 className="font-medium text-fg mb-4">Chiqim — kategoriya bo'yicha</h2>
          <CategoryBars data={chiqimBreakdown} emptyLabel="Bu oyda chiqim yo'q" />
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
  });
}
