"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCompact, uzOyNomi } from "@/lib/format";
import { ChartTooltip, ChartLegend, CHART_COLORS } from "./ChartKit";
import type { TrendPoint } from "@/lib/queries/dashboard";

// "2026-07" → "Iyl"
function monthShort(m: string): string {
  const idx = parseInt(m.slice(5, 7), 10) - 1;
  return uzOyNomi(idx).slice(0, 3);
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div>
      <ChartLegend
        items={[
          { label: "Kirim", color: CHART_COLORS.income },
          { label: "Chiqim", color: CHART_COLORS.expense },
          { label: "Sof foyda", color: CHART_COLORS.ink },
        ]}
      />
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
            tickFormatter={monthShort}
            tick={{ fontSize: 12, fill: "rgb(var(--fg-faint))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCompact(v)}
            tick={{ fontSize: 12, fill: "rgb(var(--fg-faint))" }}
            axisLine={false}
            tickLine={false}
            width={54}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgb(var(--bg-surface-2))" }} />
          <Bar dataKey="jamiKirim" name="Kirim" fill={CHART_COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="jamiChiqim" name="Chiqim" fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Line dataKey="sofFoyda" name="Sof foyda" stroke={CHART_COLORS.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
