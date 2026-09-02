"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { XodimlarPerformanceDTO, XodimPerformanceDTO } from "@/lib/queries/xodimPlan";
import type { XodimJamoaKpiDTO } from "@/lib/queries/xodimJamoaKpi";
import type { XodimDTO } from "@/lib/queries/hr";
import { XodimKarta } from "./XodimKarta";
import { PlanModal } from "./PlanModal";

type SortKalit = "foiz" | "zakaz" | "savdo" | "vazifa";

const SORT_NOMI: Record<SortKalit, string> = {
  foiz: "Plan %",
  zakaz: "Zakaz soni",
  savdo: "Savdo",
  vazifa: "Vazifalar",
};

function saralash(kalit: SortKalit) {
  return (a: XodimPerformanceDTO, b: XodimPerformanceDTO): number => {
    switch (kalit) {
      case "foiz":
        return (b.plan?.foiz ?? -1) - (a.plan?.foiz ?? -1);
      case "zakaz":
        return b.zakazlar - a.zakazlar;
      case "savdo":
        return b.savdo - a.savdo;
      case "vazifa":
        return b.vazifa.bajarildi - a.vazifa.bajarildi;
    }
  };
}

/**
 * DIREKTOR PANELI — umumiy performance, saralash (reyting) va xodim
 * kartochkalari. Ma'lumot serverdan bitta payload bilan keladi.
 */
export function PerformancePanel({
  performance,
  xodimlar,
  jamoaKpi,
  lavozimlar,
  onTahrir,
  onYangi,
}: {
  performance: XodimlarPerformanceDTO;
  xodimlar: XodimDTO[];
  /** Lavozim kesimidagi oy KPI'si (kalit: Employee.id). */
  jamoaKpi: Record<string, XodimJamoaKpiDTO>;
  /** Faol lavozimlar — filtr tugmalari (30-talab, dinamik). */
  lavozimlar: { id: string; nomi: string }[];
  onTahrir: (x: XodimDTO) => void;
  onYangi: () => void;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<SortKalit>("foiz");
  const [lavozimId, setLavozimId] = useState("");
  const [planModal, setPlanModal] = useState<XodimPerformanceDTO | null>(null);
  const d = performance.dashboard;

  const saralangan = useMemo(
    () =>
      [...performance.xodimlar]
        .filter((x) => !lavozimId || jamoaKpi[x.id]?.lavozimlar.some((l) => l.categoryId === lavozimId))
        .sort(saralash(sort)),
    [performance.xodimlar, sort, lavozimId, jamoaKpi]
  );

  // Reyting o'rni — plan foizi bo'yicha (faqat plani bor faollar raqamlanadi).
  const orinlar = useMemo(() => {
    const planli = performance.xodimlar
      .filter((x) => x.isActive && x.plan)
      .sort((a, b) => b.plan!.foiz - a.plan!.foiz);
    return new Map(planli.map((x, i) => [x.id, i + 1]));
  }, [performance.xodimlar]);

  if (performance.xodimlar.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="👷"
          title="Hali xodim yo'q"
          description="Xodim kartochkasi tizim hisobidan alohida: tizimga kirmaydigan xodimlarga ham oylik va plan yuritiladi."
          action={<Button onClick={onYangi}>Birinchi xodim</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3">
          <p className="text-2xs text-muted">Faol xodim</p>
          <p className="text-xl font-bold text-fg tnum">{d.faolXodim}</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xs text-muted">O&apos;rtacha plan bajarilishi</p>
          <p className="text-xl font-bold text-fg tnum">
            {d.ortachaFoiz !== null ? `${d.ortachaFoiz}%` : "—"}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-2xs text-muted">100%+ bajargan</p>
          <p className="text-xl font-bold text-income tnum">{d.bajarganlar}</p>
        </Card>
        <Card className="p-3">
          <p className="text-2xs text-muted">Plan ortda</p>
          <p className="text-xl font-bold text-warning tnum">{d.ortda}</p>
        </Card>
        <Card className="p-3 col-span-2 sm:col-span-1">
          <p className="text-2xs text-muted">Eng yaxshi xodim</p>
          {d.engYaxshi ? (
            <p className="text-sm font-bold text-fg truncate">
              🏆 {d.engYaxshi.ism} — <span className="tnum">{d.engYaxshi.foiz}%</span>
            </p>
          ) : (
            <p className="text-sm text-faint">Plan belgilanmagan</p>
          )}
        </Card>
      </div>

      {/* LAVOZIM FILTRI (30-talab) — biznes lavozimlaridan dinamik. */}
      {lavozimlar.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[{ id: "", nomi: "Barchasi" }, ...lavozimlar].map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLavozimId(l.id)}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border transition ${
                l.id === lavozimId
                  ? "bg-brand text-white border-transparent"
                  : "border-line bg-surface text-muted hover:border-brand/50"
              }`}
            >
              {l.nomi}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-2xs text-muted">Saralash:</span>
        {(Object.keys(SORT_NOMI) as SortKalit[]).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={sort === k ? "primary" : "secondary"}
            onClick={() => setSort(k)}
          >
            {SORT_NOMI[k]}
          </Button>
        ))}
      </div>

      {saralangan.length === 0 && (
        <p className="text-sm text-muted">Bu lavozimda xodim yo&apos;q.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {saralangan.map((x) => (
          <XodimKarta
            key={x.id}
            xodim={x}
            jamoa={jamoaKpi[x.id] ?? null}
            orin={orinlar.get(x.id) ?? null}
            onPlan={() => setPlanModal(x)}
            onTahrir={() => {
              const dto = xodimlar.find((v) => v.id === x.id);
              if (dto) onTahrir(dto);
            }}
          />
        ))}
      </div>

      {planModal && (
        <PlanModal
          employeeId={planModal.id}
          ism={planModal.ism}
          oy={performance.oy}
          plan={planModal.plan}
          userIdBor={Boolean(planModal.userId)}
          onClose={() => setPlanModal(null)}
          onDone={() => {
            setPlanModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
