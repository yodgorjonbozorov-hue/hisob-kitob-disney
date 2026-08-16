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
        <Card className={report.sofFoyda >= 0 ? "bg-income-soft border-income/40" : "bg-expense-soft border-expense/40"}>
          <p className="text-muted text-sm mb-1">Sof foyda</p>
          <p className={`text-2xl font-bold ${report.sofFoyda >= 0 ? "text-income" : "text-expense"}`}>
            {formatSomLabel(report.sofFoyda)}
          </p>
          <p className="text-xs mt-1">
            O'tgan oyga nisbatan <ChangeLabel value={report.changePct.sofFoyda} />
          </p>
        </Card>
      </div>

      {/* QARZ — real pul harakatidan ALOHIDA blok. Yuqoridagi "Jami kirim" va
          "Sof foyda" ichida qarzga berilgan savdo YO'Q; qarzdan tushgan pul
          esa bor (u haqiqatan kelgan pul). */}
      <Card>
        <p className="text-muted text-sm mb-3">
          Qarz harakati <span className="text-faint">— sof foydaga qo&apos;shilmaydi</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-faint mb-0.5">Qarzga berilgan</p>
            <p className="text-lg font-semibold text-debt tnum">
              {formatSomLabel(report.qarz.berilgan)}
            </p>
          </div>
          <div>
            <p className="text-xs text-faint mb-0.5">Qarzdan tushgan pul</p>
            <p className="text-lg font-semibold text-income tnum">
              {formatSomLabel(report.qarz.tushgan)}
            </p>
            <p className="text-2xs text-faint mt-0.5">Jami kirim ichida</p>
          </div>
          <div>
            <p className="text-xs text-faint mb-0.5">Ochiq qarz qoldig&apos;i</p>
            <p className="text-lg font-semibold text-fg tnum">
              {formatSomLabel(report.qarz.ochiqQoldiq)}
            </p>
          </div>
        </div>
      </Card>

      {/* Avto rejimi: oy davomida sotilgan har mashina bo'yicha sof foyda. */}
      {report.avto && report.avto.qatorlar.length > 0 && <AvtoJadval yakun={report.avto} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryTable title="Kirim taqsimoti" data={report.kirimByCategory} tone="kirim" />
        <CategoryTable title="Chiqim taqsimoti" data={report.chiqimByCategory} tone="chiqim" />
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={`/api/reports/monthly/pdf?month=${report.month}`}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand hover:bg-brand-ink text-white transition"
        >
          PDF yuklab olish
        </a>
        <a
          href={`/api/reports/monthly/excel?month=${report.month}`}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-income hover:brightness-110 text-white transition"
        >
          Excel yuklab olish
        </a>
      </div>
    </div>
  );
}

/** Sotilgan mashinalar: olingan narx → xarajat → sotilgan narx → sof foyda. */
function AvtoJadval({ yakun }: { yakun: NonNullable<MonthlyReport["avto"]> }) {
  const jamiSotilganSumma = yakun.jamiTannarx + yakun.jamiXarajat + yakun.jamiSofFoyda;
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-semibold text-fg">Sotilgan mashinalar bo&apos;yicha sof foyda</h2>
        <p className="text-sm text-muted">
          {yakun.jamiSotilgan} ta mashina ·{" "}
          <span className={yakun.jamiSofFoyda >= 0 ? "text-income font-medium" : "text-expense font-medium"}>
            {formatSomLabel(yakun.jamiSofFoyda)}
          </span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-2">Mashina</th>
              <th className="text-right px-3 py-2">Olingan narx</th>
              <th className="text-right px-3 py-2">Xarajat</th>
              <th className="text-right px-3 py-2">Sotilgan narx</th>
              <th className="text-right px-5 py-2">Sof foyda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {yakun.qatorlar.map((q, i) => (
              <tr key={`${q.nomi}-${i}`}>
                <td className="px-5 py-2.5 font-medium">
                  {q.nomi}
                  {q.avtoRaqam && <span className="ml-2 text-2xs text-faint">{q.avtoRaqam}</span>}
                </td>
                <td className="px-3 py-2.5 text-right tnum">{formatSomLabel(q.olinganNarx)}</td>
                <td className="px-3 py-2.5 text-right tnum text-muted">
                  {q.xarajat > 0 ? formatSomLabel(q.xarajat) : "—"}
                </td>
                <td className="px-3 py-2.5 text-right tnum">{formatSomLabel(q.sotilganNarx)}</td>
                <td
                  className={`px-5 py-2.5 text-right tnum font-medium ${
                    q.sofFoyda >= 0 ? "text-income" : "text-expense"
                  }`}
                >
                  {formatSomLabel(q.sofFoyda)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line">
            <tr className="font-medium">
              <td className="px-5 py-2.5">Jami</td>
              <td className="px-3 py-2.5 text-right tnum">{formatSomLabel(yakun.jamiTannarx)}</td>
              <td className="px-3 py-2.5 text-right tnum">
                {yakun.jamiXarajat > 0 ? formatSomLabel(yakun.jamiXarajat) : "—"}
              </td>
              <td className="px-3 py-2.5 text-right tnum">{formatSomLabel(jamiSotilganSumma)}</td>
              <td
                className={`px-5 py-2.5 text-right tnum ${
                  yakun.jamiSofFoyda >= 0 ? "text-income" : "text-expense"
                }`}
              >
                {formatSomLabel(yakun.jamiSofFoyda)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
