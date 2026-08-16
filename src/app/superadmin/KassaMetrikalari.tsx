import { formatSom } from "@/lib/format";
import type { KassaMetrikalari as Metrikalar } from "@/lib/superadmin/kassa";

/**
 * SUPERADMIN — barcha tenantlar bo'ylab kassir kassalari kesimi (talab 18).
 * Bu raqamlar biznes hisobotlaridan ALOHIDA: ular kassirlarning qo'lidagi pul.
 */
export function KassaMetrikalari({ m }: { m: Metrikalar }) {
  const qatorlar: { label: string; value: string; tone?: string }[] = [
    { label: "Jami kassalar", value: String(m.jamiKassa) },
    { label: "Jami kassadagi pul", value: formatSom(m.jamiKassaPuli) },
    { label: "Bugungi kirim", value: formatSom(m.bugungiKirim) },
    { label: "Bugungi chiqim", value: formatSom(m.bugungiChiqim) },
    { label: "Topshirilgan pul", value: formatSom(m.topshirilgan) },
    {
      label: "Kutilayotgan topshiriq",
      value: `${m.kutilayotgan} ta · ${formatSom(m.kutilayotganSumma)}`,
      tone: m.kutilayotgan > 0 ? "text-debt" : undefined,
    },
    { label: "Kamomad", value: formatSom(m.kamomad), tone: m.kamomad > 0 ? "text-expense" : undefined },
    { label: "Ortiqcha", value: formatSom(m.ortiqcha), tone: m.ortiqcha > 0 ? "text-debt" : undefined },
  ];

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-card p-5">
      <h2 className="font-semibold text-fg mb-1">Kassir kassalari</h2>
      <p className="text-xs text-faint mb-3">
        Kassirlarning qo&apos;lidagi naqd. Kirim/chiqim hisobotlaridan alohida yuritiladi.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {qatorlar.map((q) => (
          <div key={q.label} className="bg-surface-2 rounded-xl p-3">
            <p className="text-xs text-muted">{q.label}</p>
            <p className={`text-base font-bold tnum mt-1 ${q.tone ?? "text-fg"}`}>{q.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
