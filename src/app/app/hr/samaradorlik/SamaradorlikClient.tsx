"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatSom } from "@/lib/format";
import type {
  KategoriyaAnalitikaDTO,
  KategoriyaTabDTO,
  KategoriyaXodimStatDTO,
} from "@/lib/queries/kategoriyaAnalitika";
import { XodimAvatar } from "../XodimAvatar";
import { PlanProgress } from "../PlanProgress";
import { DavrFiltri, BOSH_DAVR, type Davr } from "@/app/app/tranzaksiyalar/xodimlar/DavrFiltri";

/** Reyting medallari — dastlabki uch o'rin. */
const MEDALLAR = ["🥇", "🥈", "🥉"];

/**
 * SAMARADORLIK (klient): davr filtri + kategoriya tablari + KPI + reyting.
 * KPI to'plami kategoriya TURIGA qarab: "sotuvchi" — savdo ko'rsatkichlari,
 * "ijrochi" — bajarilgan ish soni (ma'nosiz KPI ko'rsatilmaydi).
 */
export function SamaradorlikClient({
  tablar,
  initial,
}: {
  tablar: KategoriyaTabDTO[];
  initial: KategoriyaAnalitikaDTO | null;
}) {
  const [davr, setDavr] = useState<Davr>(BOSH_DAVR);
  const [categoryId, setCategoryId] = useState(initial?.kategoriya.id ?? tablar[0]?.id ?? "");
  const [data, setData] = useState<KategoriyaAnalitikaDTO | null>(initial);
  const [loading, setLoading] = useState(false);
  const birinchi = useRef(true);

  useEffect(() => {
    if (birinchi.current) {
      birinchi.current = false;
      return;
    }
    if (!categoryId) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetch(
      `/api/hr/samaradorlik?categoryId=${categoryId}&from=${davr.from}&to=${davr.to}`,
      { signal: ctrl.signal }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { analitika: KategoriyaAnalitikaDTO | null }) => setData(d.analitika))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [categoryId, davr.from, davr.to]);

  const sotuvchimi = data?.kategoriya.turi === "sotuvchi";
  const havolaQuery = `?kategoriya=${categoryId}&from=${davr.from}&to=${davr.to}`;

  return (
    <div className="space-y-4">
      <DavrFiltri davr={davr} onChange={setDavr} />

      {/* Kategoriya tablari — mobil'da gorizontal siljiydi */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tablar.map((t) => (
          <button
            key={t.id}
            onClick={() => setCategoryId(t.id)}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border transition ${
              t.id === categoryId
                ? "bg-brand text-white border-transparent"
                : "border-line bg-surface text-muted hover:border-brand/50"
            }`}
          >
            {t.nomi}
            <span className={`ml-1.5 text-2xs ${t.id === categoryId ? "text-white/80" : "text-faint"}`}>
              {t.azoSoni}
            </span>
          </button>
        ))}
      </div>

      {!data ? (
        <EmptyState title="Kategoriya topilmadi" description="Tab tanlang yoki sahifani yangilang." />
      ) : (
        <>
          {/* KPI — kategoriya turiga mos to'plam */}
          <div className={`grid grid-cols-2 gap-3 ${sotuvchimi ? "lg:grid-cols-5 sm:grid-cols-3" : "sm:grid-cols-4"}`}>
            {sotuvchimi ? (
              <>
                <Kpi label="Jami sotuv" qiymat={`${formatSom(data.kpi.jamiSotuv)} so'm`} loading={loading} />
                <Kpi label="Jami zakaz" qiymat={`${data.kpi.jamiZakaz} ta`} loading={loading} />
                <Kpi label="Yutilgan zakaz" qiymat={`${data.kpi.yutilganZakaz} ta`} loading={loading} />
                <Kpi label="Konversiya" qiymat={`${data.kpi.konversiya}%`} loading={loading} />
                <Kpi label="Eng yaxshi sotuvchi" qiymat={data.kpi.engYaxshi?.ism ?? "—"} loading={loading} />
              </>
            ) : (
              <>
                <Kpi label="Jami bajarilgan ish" qiymat={`${data.kpi.yutilganZakaz} ta`} loading={loading} />
                <Kpi label="Faol xodimlar" qiymat={`${data.kpi.faolXodim} ta`} loading={loading} />
                <Kpi label="Eng ko'p bajargan" qiymat={data.kpi.engYaxshi?.ism ?? "—"} loading={loading} />
                <Kpi label="O'rtacha zakaz/xodim" qiymat={`${data.kpi.ortachaZakaz} ta`} loading={loading} />
              </>
            )}
          </div>

          {/* Reyting — karta-qatorlar */}
          <Card className="p-0 overflow-hidden">
            {data.xodimlar.length === 0 ? (
              <EmptyState
                icon="👥"
                title="Bu kategoriyada xodim yo'q"
                description="Kategoriyalar sahifasida xodimlarni biriktiring."
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.xodimlar.map((x) => (
                  <XodimQator key={x.employeeId} x={x} sotuvchimi={sotuvchimi} havolaQuery={havolaQuery} />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function XodimQator({
  x,
  sotuvchimi,
  havolaQuery,
}: {
  x: KategoriyaXodimStatDTO;
  sotuvchimi: boolean;
  havolaQuery: string;
}) {
  return (
    <li>
      <Link
        href={`/app/hr/samaradorlik/${x.employeeId}${havolaQuery}`}
        className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-surface-2 transition"
      >
        <span className="w-7 text-center text-sm shrink-0" aria-label={`${x.orin}-o'rin`}>
          {MEDALLAR[x.orin - 1] ?? <span className="text-faint tnum">{x.orin}</span>}
        </span>
        <XodimAvatar ism={x.ism} rasmUrl={x.rasmUrl} size="sm" />
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-fg truncate">
            {x.ism}
            {!x.isActive && <span className="text-2xs text-faint"> · nofaol</span>}
            {!x.azo && <span className="text-2xs text-faint"> · a&apos;zolikdan chiqqan</span>}
          </span>
          <span className="block text-xs text-muted">
            {x.jami} ta zakaz · {x.yutilgan} {sotuvchimi ? "yutilgan" : "bajarilgan"}
            {x.yutqazilgan > 0 ? ` · ${x.yutqazilgan} yutqazilgan` : ""}
          </span>
          {x.plan && (
            <span className="block mt-1 max-w-xs">
              <PlanProgress plan={x.plan} compact />
            </span>
          )}
        </span>
        {sotuvchimi ? (
          <span className="text-right shrink-0">
            <span className="block font-display tnum font-semibold text-fg">{formatSom(x.summa)}</span>
            <span className="block text-xs text-muted">so&apos;m sotuv</span>
          </span>
        ) : (
          <span className="text-right shrink-0">
            <span className="block font-display tnum font-semibold text-fg">{x.yutilgan}</span>
            <span className="block text-xs text-muted">bajarilgan</span>
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-faint shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}

function Kpi({ label, qiymat, loading }: { label: string; qiymat: string; loading: boolean }) {
  return (
    <Card>
      <p className="text-muted text-xs mb-1">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <p className="text-lg font-bold text-fg tnum truncate">{qiymat}</p>
      )}
    </Card>
  );
}
