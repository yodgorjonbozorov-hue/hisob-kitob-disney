"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatSomLabel } from "@/lib/format";

const PALETTE = [
  "#059669",
  "#0891b2",
  "#7c3aed",
  "#d97706",
  "#db2777",
  "#4f46e5",
  "#65a30d",
  "#0284c7",
  "#c026d3",
  "#ea580c",
];

export interface PieDatum {
  nomi: string;
  summa: number;
  foiz: number;
}

export function CategoryPieChart({ data, emptyLabel }: { data: PieDatum[]; emptyLabel: string }) {
  if (data.length === 0) {
    return <p className="text-slate-400 text-sm text-center py-12">{emptyLabel}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="summa"
          nameKey="nomi"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(entry) => `${entry.foiz.toFixed(0)}%`}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatSomLabel(value)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
