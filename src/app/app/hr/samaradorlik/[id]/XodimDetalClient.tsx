"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatSom, formatDateUZ } from "@/lib/format";
import { USTUN_NOMI, type Ustun } from "@/lib/crm/pipeline";
import type { XodimKategoriyaDetalDTO } from "@/lib/queries/kategoriyaAnalitika";
import { XodimAvatar } from "../../XodimAvatar";
import { PlanProgress } from "../../PlanProgress";
import { DavrFiltri, davrChegara, type Davr } from "@/app/app/tranzaksiyalar/xodimlar/DavrFiltri";

/** Doska ustuni → belgi ohangi (CRM kartalari bilan bir xil o'qish). */
const USTUN_TONE: Record<string, "kirim" | "chiqim" | "warning" | "info" | "neutral"> = {
  YUTILDI: "kirim",
  YOQOTILDI: "chiqim",
  JARAYONDA: "warning",
  BUGUNGI: "info",
  KUTILAYOTGAN: "neutral",
};

/**
 * XODIM TAFSILOTI (klient): davr filtri + KPI + plan + zakazlar lentasi.
 * Zakaz qatori bosilsa CRM doskasida o'sha buyurtma ochiladi (?buyurtma=ID).
 */
export function XodimDetalClient({
  initial,
  employeeId,
  categoryId,
  initialOraliq,
}: {
  initial: XodimKategoriyaDetalDTO;
  employeeId: string;
  categoryId: string | null;
  initialOraliq: { from: string; to: string };
}) {
  const oyChegara = davrChegara("oy");
  const [davr, setDavr] = useState<Davr>({
    turi: initialOraliq.from === oyChegara.from && initialOraliq.to === oyChegara.to ? "oy" : "sana",
    ...initialOraliq,
  });
  const [data, setData] = useState<XodimKategoriyaDetalDTO>(initial);
  const [loading, setLoading] = useState(false);
  const birinchi = useRef(true);

  useEffect(() => {
    if (birinchi.current) {
      birinchi.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const kategoriya = categoryId ? `&categoryId=${categoryId}` : "";
    fetch(`/api/hr/samaradorlik/xodim/${employeeId}?from=${davr.from}&to=${davr.to}${kategoriya}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: XodimKategoriyaDetalDTO) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [employeeId, categoryId, davr.from, davr.to]);

  const sotuvchimi = data.kategoriya?.turi === "sotuvchi";

  return (
    <div className="space-y-4">
      <DavrFiltri davr={davr} onChange={setDavr} />

      {/* Xodim sarlavha kartasi */}
      <Card>
        <div className="flex items-center gap-3">
          <XodimAvatar ism={data.xodim.ism} rasmUrl={data.xodim.rasmUrl} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-fg truncate">
              {data.xodim.ism}
              {!data.xodim.isActive && <span className="text-2xs text-faint"> · nofaol</span>}
            </p>
            <p className="text-xs text-muted truncate">
              {data.xodim.kategoriyalar.length > 0
                ? data.xodim.kategoriyalar.join(" · ")
                : data.xodim.lavozim ?? "Kategoriyasiz"}
            </p>
          </div>
          {data.orin !== null && (
            <span className="text-right shrink-0">
              <span className="block text-lg font-bold text-fg tnum">
                {["🥇", "🥈", "🥉"][data.orin - 1] ?? `${data.orin}-`}
              </span>
              <span className="block text-2xs text-muted">o&apos;rin</span>
            </span>
          )}
        </div>
      </Card>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Kpi label="Olingan zakazlar" qiymat={`${data.stat.jami} ta`} loading={loading} />
        <Kpi label="Bugungi" qiymat={`${data.stat.bugungi} ta`} loading={loading} />
        <Kpi label="Jarayonda" qiymat={`${data.stat.jarayonda} ta`} loading={loading} />
        <Kpi label={sotuvchimi ? "Yutilgan" : "Bajarilgan"} qiymat={`${data.stat.yutilgan} ta`} loading={loading} />
        <Kpi label="Yo'qotilgan" qiymat={`${data.stat.yutqazilgan} ta`} loading={loading} />
        <Kpi
          label={sotuvchimi ? "Sotuv" : "Qatnashgan zakazlar tushumi"}
          qiymat={`${formatSom(data.stat.summa)} so'm`}
          loading={loading}
        />
        {/* Bonus hisobi shu raqamga tayanadi: qarzga ketgan qism kirmaydi. */}
        <Kpi
          label="To'liq puli kelgan sotuv"
          qiymat={`${formatSom(data.stat.tolanganSotuv)} so'm`}
          loading={loading}
        />
        <Kpi label="O'rtacha chek" qiymat={`${formatSom(data.stat.ortacha)} so'm`} loading={loading} />
        <Kpi label="Konversiya" qiymat={`${data.stat.konversiya}%`} loading={loading} />
      </div>

      {/* Oylik plan (davr oxiri oyi) */}
      {data.plan && (
        <Card>
          <PlanProgress plan={data.plan} />
          <p className="text-2xs text-faint mt-2">
            {data.plan.foiz >= 100 ? "Plan bajarildi" : "Plan bajarilmoqda"} · {data.plan.oy}
          </p>
        </Card>
      )}

      {/* Zakazlar lentasi */}
      <Card className="p-0 overflow-hidden">
        {data.zakazlar.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Bu davrda zakaz yo'q"
            description="Tanlangan davrda xodim biriktirilgan buyurtma topilmadi."
          />
        ) : (
          <ul className="divide-y divide-line">
            {data.zakazlar.map((z, i) => (
              <li key={`${z.dealId}-${i}`}>
                <Link
                  href={`/app/crm?buyurtma=${z.dealId}`}
                  className="flex items-center gap-3 px-4 py-3 min-h-[60px] hover:bg-surface-2 transition"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-fg truncate">
                      {z.nomi}
                      {z.mijoz ? <span className="text-muted font-normal"> — {z.mijoz}</span> : null}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatDateUZ(new Date(z.sana))} · {z.kategoriyaNomi}
                    </span>
                  </span>
                  <span className="text-right shrink-0 space-y-1">
                    <span className="block font-display tnum font-semibold text-fg">
                      {z.summa > 0 ? formatSom(z.summa) : "—"}
                    </span>
                    <Badge tone={USTUN_TONE[z.ustun] ?? "neutral"}>
                      {USTUN_NOMI[z.ustun as Ustun] ?? z.stageNomi}
                    </Badge>
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

function Kpi({ label, qiymat, loading }: { label: string; qiymat: string; loading: boolean }) {
  return (
    <Card>
      <p className="text-muted text-xs mb-1">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <p className="text-base font-bold text-fg tnum truncate">{qiymat}</p>
      )}
    </Card>
  );
}
