"use client";

import { formatMoney } from "@/lib/format";

interface TipPayload {
  name: string;
  value: number;
  color: string;
}

/** O'zimiz yasagan tooltip — sana sarlavha + rangli nuqta + tabular summa. */
export function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TipPayload[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg bg-surface border border-line shadow-raised px-3 py-2 text-xs">
      {label && <p className="font-medium text-fg mb-1">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-muted">{p.name}</span>
            <span className="ml-auto font-display tnum text-fg">{formatMoney(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Grafik tepasidagi rangli nuqtali izoh (legend qutisi o'rniga). */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export const CHART_COLORS = {
  income: "#0E7C57",
  expense: "#C0362C",
  ink: "#0C1A21",
  brand: "#0B6B5F",
};
