"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatSomLabel } from "@/lib/format";
import type { DailyPoint } from "@/lib/queries/dashboard";

export function DailyDynamicsChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-12">Bu oy uchun ma'lumot yo'q</p>;
  }

  const withDay = data.map((d) => ({ ...d, kun: d.date.slice(-2) }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={withDay}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="kun" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(value: number) => formatSomLabel(value)} />
        <Legend />
        <Area type="monotone" dataKey="kirim" name="Kirim" stroke="#059669" fill="#a7f3d0" />
        <Area type="monotone" dataKey="chiqim" name="Chiqim" stroke="#e11d48" fill="#fecdd3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
