"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { shiftMonthString, parseMonthString } from "@/lib/date";
import { formatMonthLabel } from "@/lib/format";
import type { XodimOylikHisobi } from "@/lib/kpi/oylik";
import type { DashboardXulosa } from "@/lib/kpi/dashboard";
import { KpiKarta } from "./KpiKarta";
import { KpiXulosa } from "./KpiXulosa";

type PlanFiltri = "hammasi" | "bajargan" | "ortda";
type BallFiltri = "hammasi" | "yaxshi" | "ogohlantirish" | "risk" | "kritik";

/**
 * XODIMLAR KPI DASHBOARD'i.
 *
 * Filtr va qidiruv KLIENTDA: ro'yxat bitta so'rovda to'liq keladi (server
 * uni bitta agregatda hisoblaydi), shuning uchun har filtr bosilganda
 * qayta so'rov yubormaslik ham tezroq, ham sodda.
 */
export function KpiDashboardClient({
  oy,
  xodimlar,
  xulosa,
  boshlangichBall,
  lavozimlar,
  sozlashMumkin,
}: {
  oy: string;
  xodimlar: XodimOylikHisobi[];
  xulosa: DashboardXulosa | null;
  boshlangichBall: number;
  lavozimlar: string[];
  sozlashMumkin: boolean;
}) {
  const router = useRouter();
  const [qidiruv, setQidiruv] = useState("");
  const [lavozim, setLavozim] = useState("hammasi");
  const [planFiltr, setPlanFiltr] = useState<PlanFiltri>("hammasi");
  const [ballFiltr, setBallFiltr] = useState<BallFiltri>("hammasi");
  const [nofaollar, setNofaollar] = useState(false);

  const { year, monthIndex0 } = parseMonthString(oy);

  /** Reyting o'rni — FILTRDAN OLDIN, ya'ni filtr o'rinni siljitmaydi. */
  const orinlar = useMemo(() => {
    const tartib = [...xodimlar]
      .filter((x) => x.isActive)
      .sort((a, b) => b.sotuv - a.sotuv || b.jami - a.jami);
    return new Map(tartib.map((x, i) => [x.employeeId, i + 1]));
  }, [xodimlar]);

  const korinadigan = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    return xodimlar.filter((x) => {
      if (!nofaollar && !x.isActive) return false;
      if (q && !`${x.ism} ${x.lavozim ?? ""}`.toLowerCase().includes(q)) return false;
      if (lavozim !== "hammasi" && (x.lavozim ?? "—") !== lavozim) return false;
      if (planFiltr === "bajargan" && !x.planBajarildi) return false;
      if (planFiltr === "ortda" && x.planBajarildi) return false;
      if (ballFiltr !== "hammasi" && x.ballHolati !== ballFiltr) return false;
      return true;
    });
  }, [xodimlar, qidiruv, lavozim, planFiltr, ballFiltr, nofaollar]);

  function oyniOzgart(delta: number) {
    router.push(`/app/hr/kpi?oy=${shiftMonthString(oy, delta)}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => oyniOzgart(-1)} aria-label="Oldingi oy">
            ←
          </Button>
          <span className="text-sm font-medium text-fg">{formatMonthLabel(year, monthIndex0)}</span>
          <Button size="sm" variant="ghost" onClick={() => oyniOzgart(1)} aria-label="Keyingi oy">
            →
          </Button>
        </div>
        {sozlashMumkin && (
          <Link href="/app/hr/kpi/sozlamalar" className="text-2xs text-brand hover:underline">
            Oylik va bonus sozlamalari
          </Link>
        )}
      </div>

      {xulosa && <KpiXulosa xulosa={xulosa} oy={oy} />}

      <div className="rounded-2xl border border-line bg-surface p-3 space-y-2">
        <input
          type="search"
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Xodim ismi yoki lavozimi bo'yicha qidirish"
          className={INPUT_CLASS}
          aria-label="Xodim qidirish"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select
            value={lavozim}
            onChange={setLavozim}
            aria-label="Lavozim"
            options={[
              { value: "hammasi", label: "Barcha lavozimlar" },
              ...lavozimlar.map((l) => ({ value: l, label: l })),
            ]}
          />
          <Select
            value={planFiltr}
            onChange={(v) => setPlanFiltr(v as PlanFiltri)}
            aria-label="Plan holati"
            options={[
              { value: "hammasi", label: "Plan: hammasi" },
              { value: "bajargan", label: "Plan bajarganlar" },
              { value: "ortda", label: "Plandan ortda" },
            ]}
          />
          <Select
            value={ballFiltr}
            onChange={(v) => setBallFiltr(v as BallFiltri)}
            aria-label="Ball holati"
            options={[
              { value: "hammasi", label: "Ball: hammasi" },
              { value: "yaxshi", label: "Yaxshi (85+)" },
              { value: "ogohlantirish", label: "Ogohlantirish (70-84)" },
              { value: "risk", label: "Risk (55-69)" },
              { value: "kritik", label: "Kritik (55 dan past)" },
            ]}
          />
        </div>
        <label className="flex items-center gap-2 text-2xs text-muted">
          <input
            type="checkbox"
            checked={nofaollar}
            onChange={(e) => setNofaollar(e.target.checked)}
            className="rounded border-line"
          />
          Ishdan chiqqanlarni ham ko&apos;rsatish
        </label>
      </div>

      {korinadigan.length === 0 ? (
        <EmptyState
          title="Xodim topilmadi"
          description={
            xodimlar.length === 0
              ? "Bu bizneste hali xodim qo'shilmagan. Avval Xodimlar bo'limidan xodim qo'shing."
              : "Tanlangan filtrlarga mos xodim yo'q. Filtrlarni bo'shatib ko'ring."
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {korinadigan.map((x) => (
            <KpiKarta
              key={x.employeeId}
              xodim={x}
              boshlangichBall={boshlangichBall}
              orin={orinlar.get(x.employeeId) ?? null}
              oy={oy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
