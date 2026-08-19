"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatMoneyCompact } from "@/lib/format";

/**
 * MINIMALIST GRAFIKLAR (talab 5/37).
 *
 * Qoidalar:
 *  · animatsiya YO'Q — panel har renderda "o'ynamaydi";
 *  · gradient/soya yo'q, bitta brend rangi;
 *  · o'q belgilari siyrak — raqamlar zichligi grafikni bosib ketmasin;
 *  · konteyner responsiv, balandlik qat'iy (layout sakramaydi).
 */

export interface Nuqta {
  sana: string;
  qiymat: number;
}

const OQ_STIL = { fontSize: 11, fill: "rgb(var(--fg-faint))" };

function sanaQisqa(sana: string): string {
  // "2026-08-19" -> "19.08"
  const [, oy, kun] = sana.split("-");
  return `${kun}.${oy}`;
}

function Qutti({
  active,
  payload,
  label,
  pul,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  pul?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 shadow-card">
      <p className="text-2xs text-muted">{label}</p>
      <p className="text-sm font-display text-fg tabular-nums">
        {pul ? `${formatMoneyCompact(v)} so'm` : v.toLocaleString("ru-RU")}
      </p>
    </div>
  );
}

export function ChiziqliGrafik({
  nuqtalar,
  pul = false,
  balandlik = 180,
}: {
  nuqtalar: Nuqta[];
  pul?: boolean;
  balandlik?: number;
}) {
  return (
    <div style={{ height: balandlik }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={nuqtalar} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
          <XAxis
            dataKey="sana"
            tickFormatter={sanaQisqa}
            tick={OQ_STIL}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={OQ_STIL}
            tickLine={false}
            axisLine={false}
            width={pul ? 48 : 32}
            tickFormatter={(v: number) => (pul ? formatMoneyCompact(v) : String(v))}
            allowDecimals={false}
          />
          <Tooltip content={<Qutti pul={pul} />} cursor={{ stroke: "rgb(var(--border-strong))" }} />
          <Area
            type="monotone"
            dataKey="qiymat"
            stroke="rgb(var(--brand))"
            fill="rgb(var(--brand))"
            fillOpacity={0.12}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface UstunNuqta {
  nomi: string;
  qiymat: number;
  imkoniyat?: number;
}

export function UstunliGrafik({
  nuqtalar,
  balandlik = 260,
}: {
  nuqtalar: UstunNuqta[];
  balandlik?: number;
}) {
  return (
    <div style={{ height: balandlik }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={nuqtalar} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgb(var(--border))" horizontal={false} />
          <XAxis type="number" tick={OQ_STIL} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="nomi"
            tick={OQ_STIL}
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip content={<Qutti />} cursor={{ fill: "rgb(var(--bg-surface-2))" }} />
          <Bar dataKey="qiymat" fill="rgb(var(--brand))" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
