"use client";

import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { Money } from "@/components/ui/Money";
import type { DashboardXulosa } from "@/lib/kpi/dashboard";
import { XodimAvatar } from "../XodimAvatar";
import { qisqaSumma } from "./kpiUi";

/**
 * DIREKTOR XULOSASI VA REYTINGI — FAQAT rahbarga ko'rinadi
 * (server xodim so'roviga bu blokni umuman yubormaydi).
 */
export function KpiXulosa({ xulosa, oy }: { xulosa: DashboardXulosa; oy: string }) {
  const top = xulosa.reyting.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Jami xodimlar" value={String(xulosa.jamiXodim)} />
        <StatCard
          label="Jami sotuv"
          value={`${qisqaSumma(xulosa.jamiSotuv)} so'm`}
          accent="income"
          title={xulosa.jamiSotuv.toLocaleString("uz-UZ")}
        />
        <StatCard
          label="Oylik prognozi"
          value={`${qisqaSumma(xulosa.oylikPrognozi)} so'm`}
          accent="brand"
          title={xulosa.oylikPrognozi.toLocaleString("uz-UZ")}
        />
        <StatCard
          label="Plan bajarganlar"
          value={`${xulosa.planBajargan} / ${xulosa.planliXodim}`}
          accent={xulosa.riskdagilar > 0 ? "neutral" : "income"}
        >
          {xulosa.riskdagilar > 0 && (
            <p className="text-2xs mt-1 text-expense">{xulosa.riskdagilar} xodim riskda</p>
          )}
        </StatCard>
      </div>

      {top.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-fg mb-3">Reyting</h2>
          <ul className="space-y-2">
            {top.map((r, i) => (
              <li key={r.employeeId}>
                <Link
                  href={`/app/hr/kpi/${r.employeeId}?oy=${oy}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2 hover:bg-surface-2 transition"
                >
                  <span className="w-5 text-2xs text-faint tnum shrink-0">
                    {i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                  </span>
                  <XodimAvatar ism={r.ism} rasmUrl={r.rasmUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{r.ism}</span>
                  <span className="text-2xs text-muted tnum shrink-0 hidden sm:inline">
                    {qisqaSumma(r.sotuv)} · {r.planFoizi}% · {r.ball} ball
                  </span>
                  <Money value={r.jami} size="sm" tone="brand" suffix={false} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
