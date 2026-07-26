"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCompact } from "@/lib/format";
import { ChartTooltip, ChartLegend, CHART_COLORS } from "./ChartKit";
import type { DailyPoint } from "@/lib/queries/dashboard";

export function DailyDynamicsChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) {
    return <p className="text-faint text-sm text-center py-10">Bu oy uchun ma'lumot yo'q</p>;
  }
  const withDay = data.map((d) => ({ ...d, kun: d.date.slice(-2) }));

  return (
    <div>
      <ChartLegend
        items={[
          { label: "Kirim", color: CHART_COLORS.income },
          { label: "Chiqim", color: CHART_COLORS.expense },
        ]}
      />
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={withDay} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gKirim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.income} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART_COLORS.income} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gChiqim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.expense} stopOpacity={0.18} />
              <stop offset="100%" stopColor={CHART_COLORS.expense} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="kun" tick={{ fontSize: 12, fill: "rgb(var(--fg-faint))" }} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 12, fill: "rgb(var(--fg-faint))" }} axisLine={false} tickLine={false} width={54} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgb(var(--border-strong))" }} />
          <Area type="monotone" dataKey="kirim" name="Kirim" stroke={CHART_COLORS.income} strokeWidth={2} fill="url(#gKirim)" isAnimationActive={false} />
          <Area type="monotone" dataKey="chiqim" name="Chiqim" stroke={CHART_COLORS.expense} strokeWidth={2} fill="url(#gChiqim)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
