"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatSomLabel } from "@/lib/format";
import type { TrendPoint } from "@/lib/queries/dashboard";

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(value: number) => formatSomLabel(value)} />
        <Legend />
        <Bar dataKey="jamiKirim" name="Kirim" fill="#059669" radius={[4, 4, 0, 0]} />
        <Bar dataKey="jamiChiqim" name="Chiqim" fill="#e11d48" radius={[4, 4, 0, 0]} />
        <Line dataKey="sofFoyda" name="Sof foyda" stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
