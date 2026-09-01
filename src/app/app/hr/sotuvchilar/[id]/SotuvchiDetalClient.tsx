"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlanProgress } from "../../PlanProgress";
import { DavrFiltri, type Davr } from "@/app/app/tranzaksiyalar/xodimlar/DavrFiltri";
import { SotuvchiKpiKartalar, SotuvchiOqimQatori } from "../SotuvchiKpiKartalar";
import { SotuvBonusKarta } from "./SotuvBonusKarta";
import type { SotuvchiDetalDTO, SotuvchiZakazDTO } from "@/lib/queries/sotuvchiKpi";

const TOLOV_NOMI: Record<string, string> = {
  TOLIQ: "Puli keldi",
  QISMAN: "Qisman to'landi",
  TOLANMAGAN: "Puli kelmadi",
};

const TOLOV_RANGI: Record<string, string> = {
  TOLIQ: "text-income",
  QISMAN: "text-debt",
  TOLANMAGAN: "text-faint",
};

/**
 * BITTA SOTUVCHI STATISTIKASI (11/21/22-talab): davr filtri + KPI kartalari
 * + davrdagi zakazlar lentasi.
 */
export function SotuvchiDetalClient({
  initial,
  boshDavr,
  bonusYozaOladi,
}: {
  initial: SotuvchiDetalDTO;
  boshDavr: Davr;
  /** Boshqaruvchi bo'lsa sotuv bonusini shu yerdan yozadi (32-talab). */
  bonusYozaOladi: boolean;
}) {
  const [davr, setDavr] = useState<Davr>(boshDavr);
  const [data, setData] = useState<SotuvchiDetalDTO>(initial);
  const [loading, setLoading] = useState(false);
  const birinchi = useRef(true);

  useEffect(() => {
    if (birinchi.current) {
      birinchi.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/hr/sotuvchilar/${initial.sotuvchi.employeeId}?from=${davr.from}&to=${davr.to}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("xato"))))
      .then((d: SotuvchiDetalDTO) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [davr.from, davr.to, initial.sotuvchi.employeeId]);

  return (
    <div className="space-y-4">
      <DavrFiltri davr={davr} onChange={setDavr} otganOyBilan />

      <SotuvchiKpiKartalar kpi={data.kpi} loading={loading} />
      <SotuvchiOqimQatori kpi={data.kpi} />

      {bonusYozaOladi && (
        <SotuvBonusKarta
          employeeId={data.sotuvchi.employeeId}
          ism={data.sotuvchi.ism}
          bonusAsosi={data.kpi.bonusAsosi}
          sana={data.davr.to}
          davrMatni={`${data.davr.from} — ${data.davr.to}`}
        />
      )}

      {data.kpi.plan && (
        <Card>
          <p className="text-muted text-xs mb-2">Oylik plan ({data.oy})</p>
          <PlanProgress plan={data.kpi.plan} />
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {data.zakazlar.length === 0 ? (
          <EmptyState icon="🧾" title="Bu davrda zakaz yo'q" />
        ) : (
          <ul className="divide-y divide-line">
            {data.zakazlar.map((z) => (
              <ZakazQator key={z.dealId} z={z} />
            ))}
          </ul>
        )}
      </Card>

      <p className="text-2xs text-faint">
        &quot;Puli kelgan sotuv&quot; — qarzi to&apos;liq yopilgan zakazlar. Qisman to&apos;langan
        zakaz bonus bazasiga kirmaydi; qarz yopilgach butun summa qo&apos;shiladi.
      </p>
    </div>
  );
}

function ZakazQator({ z }: { z: SotuvchiZakazDTO }) {
  return (
    <li>
      <Link
        href={`/app/crm?buyurtma=${z.dealId}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-fg truncate">{z.nomi}</span>
          <span className="block text-2xs text-muted tnum">
            {z.sana}
            {z.mijoz ? ` · ${z.mijoz}` : ""} · {z.stageNomi}
          </span>
        </span>
        <span className="text-right shrink-0">
          <Money value={z.summa} size="sm" />
          <span className={`block text-2xs ${TOLOV_RANGI[z.tolovHolati] ?? "text-faint"}`}>
            {TOLOV_NOMI[z.tolovHolati] ?? z.tolovHolati}
          </span>
        </span>
      </Link>
    </li>
  );
}
