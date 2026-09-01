"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { useToast } from "@/components/ui/Toast";
import { shiftMonthString, parseMonthString } from "@/lib/date";
import { formatMonthLabel } from "@/lib/format";
import type { XodimOylikHisobi } from "@/lib/kpi/oylik";
import type { BallTarixDTO } from "@/lib/kpi/ball";
import type { PresetDTO } from "@/lib/kpi/vazifa";
import type { TuzatishDTO } from "@/lib/kpi/payroll";
import type { SotuvYozuvi } from "@/lib/kpi/sotuv";
import { XodimAvatar } from "../../XodimAvatar";
import { BallBelgi, PlanChizigi, qisqaSumma } from "../kpiUi";
import { OylikXulosa } from "./OylikXulosa";
import { VazifalarBloki } from "./VazifalarBloki";
import { BallTarixi } from "./BallTarixi";
import { BallModal } from "./BallModal";
import { OyYopishModal } from "./OyYopishModal";
import { OylikAmallar } from "./OylikAmallar";
import { SotuvlarBloki } from "./SotuvlarBloki";

export interface KpiDetalProps {
  hisob: XodimOylikHisobi;
  tarix: BallTarixDTO[];
  presetlar: PresetDTO[];
  tuzatishlar: TuzatishDTO[];
  sotuvlar: Array<Omit<SotuvYozuvi, "sana"> & { sana: string }>;
  boshlangichBall: number;
  kunlikLimit: number;
  bugun: string;
  ballBerish: boolean;
  tasdiqMumkin: boolean;
  tolovMumkin: boolean;
  /** Rahbar ko'rinishimi (orqaga havola KPI ro'yxatiga bo'ladi). */
  rahbar: boolean;
}

/** XODIM KPI TAFSILOTI — sotuv, plan, vazifalar, ball tarixi va oylik. */
export function KpiDetalClient(p: KpiDetalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [ballModal, setBallModal] = useState<string | null>(null);
  const [yopishModal, setYopishModal] = useState(false);
  const [qaytarilmoqda, setQaytarilmoqda] = useState<string | null>(null);

  const h = p.hisob;
  const { year, monthIndex0 } = parseMonthString(h.oy);
  const oyNomi = formatMonthLabel(year, monthIndex0);
  const vazifa = p.hisob.vazifalar.find((v) => v.taskId === ballModal) ?? null;

  function oyniOzgart(delta: number) {
    router.push(`/app/hr/kpi/${h.employeeId}?oy=${shiftMonthString(h.oy, delta)}`);
  }

  async function ballQaytar(id: string) {
    setQaytarilmoqda(id);
    try {
      const res = await fetch(`/api/hr/kpi/ball/${id}/qaytarish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Xatolik yuz berdi", tone: "error" });
        return;
      }
      toast({ message: "Ball qaytarildi", tone: "success" });
      router.refresh();
    } catch {
      toast({ message: "Tarmoq xatosi — qayta urinib ko'ring", tone: "error" });
    } finally {
      setQaytarilmoqda(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <XodimAvatar ism={h.ism} rasmUrl={h.rasmUrl} size="lg" />
          <div className="min-w-0">
            {p.rahbar && (
              <p className="text-2xs text-muted">
                <Link href="/app/hr/kpi" className="hover:text-fg">
                  Xodimlar KPI
                </Link>{" "}
                / {h.ism}
              </p>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2 flex-wrap">
              {h.ism} <BallBelgi holat={h.ballHolati} />
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {h.lavozim ?? "—"} · {oyNomi}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => oyniOzgart(-1)} aria-label="Oldingi oy">
            ←
          </Button>
          <span className="text-sm text-fg">{oyNomi}</span>
          <Button size="sm" variant="ghost" onClick={() => oyniOzgart(1)} aria-label="Keyingi oy">
            →
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <p className="text-2xs text-muted uppercase tracking-wide">Sotuv</p>
          <Money value={h.sotuv} size="display" tone="income" />
          <p className="text-2xs text-faint mt-1 tnum">
            {h.zakazlar} ta to&apos;liq to&apos;langan zakaz
          </p>
          <div className="mt-4">
            <PlanChizigi sotuv={h.sotuv} plan={h.plan} foiz={h.planFoizi} />
            <p className="text-2xs text-faint mt-1 tnum">
              Plan: {qisqaSumma(h.plan)} so&apos;m
              {h.planBajarildi && <span className="text-income"> · bajarildi</span>}
            </p>
          </div>
        </div>

        <OylikXulosa hisob={h} tuzatishlar={p.tuzatishlar} />
      </div>

      {(p.tasdiqMumkin || p.tolovMumkin) && (
        <OylikAmallar
          hisob={h}
          tasdiqMumkin={p.tasdiqMumkin}
          tolovMumkin={p.tolovMumkin}
          onYopish={() => setYopishModal(true)}
        />
      )}

      <VazifalarBloki
        vazifalar={h.vazifalar}
        boshlangichBall={p.boshlangichBall}
        ballBerish={p.ballBerish && !h.yakuniy}
        onBallAyir={setBallModal}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BallTarixi
          tarix={p.tarix}
          qaytarishMumkin={p.ballBerish && !h.yakuniy}
          onQaytar={ballQaytar}
          kutilmoqda={qaytarilmoqda}
        />
        <SotuvlarBloki sotuvlar={p.sotuvlar} userIdBor={Boolean(h.userId)} />
      </div>

      {vazifa && (
        <BallModal
          employeeId={h.employeeId}
          vazifa={vazifa}
          presetlar={p.presetlar}
          kunlikLimit={p.kunlikLimit}
          bugun={p.bugun}
          onClose={() => setBallModal(null)}
          onDone={() => {
            setBallModal(null);
            router.refresh();
          }}
        />
      )}

      {yopishModal && (
        <OyYopishModal
          hisob={h}
          oyNomi={oyNomi}
          onClose={() => setYopishModal(false)}
          onDone={() => {
            setYopishModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
