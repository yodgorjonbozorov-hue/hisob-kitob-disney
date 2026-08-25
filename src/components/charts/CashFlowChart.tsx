"use client";

import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCompact, formatMoney } from "@/lib/format";
import { CHART_COLORS } from "./ChartKit";
import type { OqimNuqta } from "@/lib/queries/dashboardPanel";

export interface OqimChizma extends OqimNuqta {
  /** O'q ostidagi qisqa yorliq ("14", "Iyl"). */
  yorliq: string;
  /** Tooltip sarlavhasi ("14 avgust 2026", "Iyul 2026"). */
  sarlavha: string;
}

/**
 * PUL OQIMI: kirim va chiqim — yumshoq maydon, sof natija — chiziq.
 *
 * Sof natija ALOHIDA chiziq bilan ko'rsatiladi, chunki u manfiy bo'lishi
 * mumkin: maydon (Area) manfiy qiymatda o'qilmaydi.
 *
 * Grid, o'q chiziqlari va Recharts'ning standart legendi yo'q (DESIGN.md).
 */
export function CashFlowChart({ data }: { data: OqimChizma[] }) {
  if (data.every((d) => d.kirim === 0 && d.chiqim === 0)) {
    return <p className="text-faint text-sm text-center py-16">Bu davrda pul harakati yo&apos;q</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="oqimKirim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.income} stopOpacity={0.2} />
            <stop offset="100%" stopColor={CHART_COLORS.income} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="oqimChiqim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.expense} stopOpacity={0.16} />
            <stop offset="100%" stopColor={CHART_COLORS.expense} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="yorliq"
          tick={{ fontSize: 11, fill: "rgb(var(--fg-faint))" }}
          axisLine={false}
          tickLine={false}
          /* Telefonda yorliqlar bir-birining ustiga chiqmasin — Recharts
             o'zi siyraklashtiradi, biz faqat minimal oraliqni beramiz. */
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(v)}
          tick={{ fontSize: 11, fill: "rgb(var(--fg-faint))" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<OqimTooltip />} cursor={{ stroke: "rgb(var(--border-strong))" }} />
        <Area
          type="monotone"
          dataKey="kirim"
          name="Kirim"
          stroke={CHART_COLORS.income}
          strokeWidth={2}
          fill="url(#oqimKirim)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="chiqim"
          name="Chiqim"
          stroke={CHART_COLORS.expense}
          strokeWidth={2}
          fill="url(#oqimChiqim)"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="sof"
          name="Sof natija"
          stroke={CHART_COLORS.ink}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: OqimChizma }[];
}

/**
 * Tooltip nuqtaning O'ZIDAN o'qiydi (ChartKit'ning umumiy tooltip'i emas):
 * sarlavhada to'liq sana kerak, seriyada esa faqat qisqa yorliq bor.
 */
function OqimTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const qatorlar = [
    { nomi: "Kirim", qiymat: d.kirim, rang: CHART_COLORS.income },
    { nomi: "Chiqim", qiymat: d.chiqim, rang: CHART_COLORS.expense },
    { nomi: "Sof natija", qiymat: d.sof, rang: CHART_COLORS.ink },
  ];
  return (
    <div className="rounded-lg bg-surface border border-line shadow-raised px-3 py-2 text-xs">
      <p className="font-medium text-fg mb-1">{d.sarlavha}</p>
      <ul className="space-y-0.5">
        {qatorlar.map((q) => (
          <li key={q.nomi} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: q.rang }} />
            <span className="text-muted">{q.nomi}</span>
            <span className="ml-auto pl-4 font-display tnum text-fg">{formatMoney(q.qiymat)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
