"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatSom } from "@/lib/format";
import type { XodimlarStatDTO } from "@/lib/queries/xodimStatistika";
import { DavrFiltri, BOSH_DAVR, type Davr } from "./DavrFiltri";

/**
 * XODIMLAR DASHBOARD (klient): davr filtri + KPI kartalari + reyting.
 * Birinchi render server bergan "Bu oy" ma'lumoti bilan; filtr almashganda
 * /api/transactions/xodimlar-statistika dan qayta olinadi.
 * Mobile-first: KPI 2 ustunli grid, reyting — karta-qatorlar (jadval yo'q).
 */
export function XodimlarClient({ initial }: { initial: XodimlarStatDTO }) {
  const [davr, setDavr] = useState<Davr>(BOSH_DAVR);
  const [stat, setStat] = useState<XodimlarStatDTO>(initial);
  const [loading, setLoading] = useState(false);
  const birinchi = useRef(true);

  useEffect(() => {
    // Boshlang'ich "Bu oy" serverdan kelgan — qayta so'ralmaydi.
    if (birinchi.current) {
      birinchi.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/transactions/xodimlar-statistika?from=${davr.from}&to=${davr.to}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: XodimlarStatDTO) => setStat(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [davr.from, davr.to]);

  const havolaQuery = `?from=${davr.from}&to=${davr.to}`;

  return (
    <div className="space-y-4">
      <DavrFiltri davr={davr} onChange={setDavr} />

      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Jami zakazlar" qiymat={`${stat.jamiZakaz} ta`} loading={loading} />
        <Kpi label="Jami sotuv" qiymat={`${formatSom(stat.jamiSumma)} so'm`} loading={loading} />
        <Kpi
          label="Eng ko'p zakaz"
          qiymat={stat.topZakaz ? stat.topZakaz.ism : "—"}
          izoh={stat.topZakaz ? `${stat.topZakaz.zakazlar} ta zakaz` : undefined}
          loading={loading}
        />
        <Kpi
          label="Eng ko'p summa"
          qiymat={stat.topSumma ? stat.topSumma.ism : "—"}
          izoh={stat.topSumma ? `${formatSom(stat.topSumma.summa)} so'm` : undefined}
          loading={loading}
        />
      </div>

      <Card className="p-0 overflow-hidden">
        {stat.xodimlar.length === 0 ? (
          <EmptyState
            title="Bu davrda savdo yo'q"
            description="Tanlangan davrda xodimlarga yozilgan kirim topilmadi."
          />
        ) : (
          <ul className="divide-y divide-line">
            {stat.xodimlar.map((x, i) => (
              <li key={x.id}>
                <Link
                  href={`/app/tranzaksiyalar/xodimlar/${x.id}${havolaQuery}`}
                  className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-surface-2 transition"
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                      i === 0 ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-fg truncate">{x.ism}</span>
                    <span className="block text-xs text-muted">
                      {x.zakazlar} ta zakaz · o&apos;rtacha {formatSom(x.ortacha)} so&apos;m
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-display tnum font-semibold text-fg">
                      {formatSom(x.summa)}
                    </span>
                    <span className="block text-xs text-muted tnum">{x.ulush}%</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-faint shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  label,
  qiymat,
  izoh,
  loading,
}: {
  label: string;
  qiymat: string;
  izoh?: string;
  loading: boolean;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-xs text-muted">{label}</p>
      {loading ? (
        <Skeleton className="h-6 w-24 mt-1" />
      ) : (
        <>
          <p className="mt-0.5 font-display tnum font-semibold text-fg truncate" title={qiymat}>
            {qiymat}
          </p>
          {izoh && <p className="text-xs text-muted tnum truncate">{izoh}</p>}
        </>
      )}
    </Card>
  );
}
