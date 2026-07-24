import { Card } from "@/components/ui/Card";
import { formatSomLabel, formatPercent, changeDirection } from "@/lib/format";
import type { MonthlyReport } from "@/lib/queries/report";

/** invert=true bo'lsa, o'sish salbiy (qizil), pasayish ijobiy (yashil) hisoblanadi — chiqim uchun. */
function ChangeLabel({ value, invert = false }: { value: number | null; invert?: boolean }) {
  const dir = changeDirection(value);
  const isGood = dir === "flat" ? null : invert ? dir === "down" : dir === "up";
  const cls = isGood === null ? "text-faint" : isGood ? "text-income" : "text-expense";
  return <span className={cls}>{formatPercent(value)}</span>;
}

function CategoryTable({ title, data, tone }: { title: string; data: { nomi: string; summa: number; foiz: number }[]; tone: "kirim" | "chiqim" }) {
  return (
    <Card>
      <h2 className="font-semibold text-fg mb-3">{title}</h2>
      {data.length === 0 ? (
        <p className="text-faint text-sm py-6 text-center">Ma'lumot yo'q</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-faint text-xs uppercase">
              <th className="pb-2">Kategoriya</th>
              <th className="pb-2 text-right">Summa</th>
              <th className="pb-2 text-right">Foiz</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((item) => (
              <tr key={item.nomi}>
                <td className="py-2">{item.nomi}</td>
                <td className={`py-2 text-right font-medium ${tone === "kirim" ? "text-income" : "text-expense"}`}>
                  {formatSomLabel(item.summa)}
                </td>
                <td className="py-2 text-right text-muted">{item.foiz.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function ReportView({ report }: { report: MonthlyReport }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-muted text-sm mb-1">Jami kirim</p>
          <p className="text-2xl font-bold text-income">{formatSomLabel(report.jamiKirim)}</p>
          <p className="text-xs mt-1">
            O'tgan oyga nisbatan <ChangeLabel value={report.changePct.kirim} />
          </p>
        </Card>
        <Card>
          <p className="text-muted text-sm mb-1">Jami chiqim</p>
          <p className="text-2xl font-bold text-expense">{formatSomLabel(report.jamiChiqim)}</p>
          <p className="text-xs mt-1">
            O'tgan oyga nisbatan <ChangeLabel value={report.changePct.chiqim} invert />
          </p>
        </Card>
        <Card className={report.sofFoyda >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}>
          <p className="text-muted text-sm mb-1">Sof foyda</p>
          <p className={`text-2xl font-bold ${report.sofFoyda >= 0 ? "text-income" : "text-expense"}`}>
            {formatSomLabel(report.sofFoyda)}
          </p>
          <p className="text-xs mt-1">
            O'tgan oyga nisbatan <ChangeLabel value={report.changePct.sofFoyda} />
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryTable title="Kirim taqsimoti" data={report.kirimByCategory} tone="kirim" />
        <CategoryTable title="Chiqim taqsimoti" data={report.chiqimByCategory} tone="chiqim" />
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/reports/monthly/pdf?month=${report.month}`}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white transition"
        >
          PDF yuklab olish
        </a>
        <a
          href={`/api/reports/monthly/excel?month=${report.month}`}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition"
        >
          Excel yuklab olish
        </a>
      </div>
    </div>
  );
}
