"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatSom } from "@/lib/format";
import type { SotuvchiKpiDTO, SotuvchilarKpiDTO } from "@/lib/queries/sotuvchiKpi";
import { XodimAvatar } from "../XodimAvatar";
import { PlanProgress } from "../PlanProgress";
import { DavrFiltri, BOSH_DAVR, type Davr } from "@/app/app/tranzaksiyalar/xodimlar/DavrFiltri";

/** Reyting medallari — dastlabki uch o'rin. */
const MEDALLAR = ["🥇", "🥈", "🥉"];

/**
 * SOTUVCHILAR REYTINGI (23-talab) — davr filtri + umumiy KPI + qatorlar.
 *
 * Reyting metrikasi — PULI KELGAN SOTUV: real pul kelmagan zakaz eng yaxshi
 * sotuvchini belgilamasin. Yutilgan summa ham ko'rinadi (farqi bilinsin).
 */
export function SotuvchilarClient({ initial }: { initial: SotuvchilarKpiDTO | null }) {
  const [davr, setDavr] = useState<Davr>(BOSH_DAVR);
  const [data, setData] = useState<SotuvchilarKpiDTO | null>(initial);
  const [loading, setLoading] = useState(false);
  const birinchi = useRef(true);

  useEffect(() => {
    if (birinchi.current) {
      birinchi.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/hr/sotuvchilar?from=${davr.from}&to=${davr.to}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("xato"))))
      .then((d: SotuvchilarKpiDTO) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [davr.from, davr.to]);

  const havolaQuery = `?from=${davr.from}&to=${davr.to}`;

  return (
    <div className="space-y-4">
      <DavrFiltri davr={davr} onChange={setDavr} otganOyBilan />

      {!data ? (
        <EmptyState title="Ma'lumot yo'q" description="Davrni tanlang yoki sahifani yangilang." />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Jam label="Olingan zakaz" qiymat={`${data.jami.olingan.soni} ta`} />
            <Jam label="Zakaz summasi" qiymat={`${formatSom(data.jami.olingan.summa)} so'm`} />
            <Jam label="Yutilgan summa" qiymat={`${formatSom(data.jami.yutilgan.summa)} so'm`} />
            <Jam label="Puli kelgan sotuv" qiymat={`${formatSom(data.jami.puliKelgan)} so'm`} />
            <Jam label="Konversiya" qiymat={`${data.jami.konversiya}%`} />
          </div>

          <Card className={`p-0 overflow-hidden ${loading ? "opacity-60" : ""}`}>
            {data.sotuvchilar.length === 0 ? (
              <EmptyState
                icon="👥"
                title="Sotuvchilar yo'q"
                description="Xodimlar → Kategoriyalar bo'limida 'Sotuvchi' turidagi kategoriya yarating va xodimlarni biriktiring."
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.sotuvchilar.map((s) => (
                  <SotuvchiQator key={s.employeeId} s={s} havolaQuery={havolaQuery} />
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Jam({ label, qiymat }: { label: string; qiymat: string }) {
  return (
    <Card>
      <p className="text-muted text-xs mb-1">{label}</p>
      <p className="text-lg font-bold text-fg tnum truncate" title={qiymat}>
        {qiymat}
      </p>
    </Card>
  );
}

function SotuvchiQator({ s, havolaQuery }: { s: SotuvchiKpiDTO; havolaQuery: string }) {
  return (
    <li>
      <Link
        href={`/app/hr/sotuvchilar/${s.employeeId}${havolaQuery}`}
        className="flex items-center gap-3 px-4 py-3 min-h-[64px] hover:bg-surface-2 transition"
      >
        <span className="w-7 text-center text-sm shrink-0" aria-label={`${s.orin}-o'rin`}>
          {MEDALLAR[s.orin - 1] ?? <span className="text-faint tnum">{s.orin}</span>}
        </span>
        <XodimAvatar ism={s.ism} rasmUrl={s.rasmUrl} size="sm" />
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-fg truncate">
            {s.ism}
            {!s.isActive && <span className="text-2xs text-faint"> · nofaol</span>}
            {!s.azo && <span className="text-2xs text-faint"> · a&apos;zolikdan chiqqan</span>}
          </span>
          <span className="block text-xs text-muted">
            {s.olingan.soni} ta olingan · {s.yutilgan.soni} yutildi · konversiya {s.konversiya}%
          </span>
          {s.plan && (
            <span className="block mt-1 max-w-xs">
              <PlanProgress plan={s.plan} compact />
            </span>
          )}
        </span>
        <span className="text-right shrink-0">
          <span className="block font-display tnum font-semibold text-fg">
            {formatSom(s.puliKelgan)}
          </span>
          <span className="block text-xs text-muted">puli kelgan</span>
        </span>
        <ChevronRight className="w-4 h-4 text-faint shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}
