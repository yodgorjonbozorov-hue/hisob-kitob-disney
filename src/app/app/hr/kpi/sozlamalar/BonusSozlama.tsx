"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { KpiSozlamaDTO } from "@/lib/kpi/sozlama";
import { IntervalTahrir } from "./IntervalTahrir";
import { PlanTahrir, type PlanQiymatlari } from "./PlanTahrir";
import { BallQoidaTahrir } from "./BallQoidaTahrir";
import type { IntervalForm, QoidaForm } from "./sozlamaShakl";

/**
 * OYLIK VA BONUS SOZLAMALARI.
 *
 * Sozlama biznesga tegishli: bu yerdagi qiymatlar boshqa bizneslarga
 * ta'sir qilmaydi. Yopilgan oylarga ham ta'sir qilmaydi — ular
 * snapshotdan o'qiladi.
 */
export function BonusSozlama({ boshlangich }: { boshlangich: KpiSozlamaDTO }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<PlanQiymatlari>({
    mavsumOylar: boshlangich.mavsumOylar,
    mavsumPlan: boshlangich.mavsumPlan,
    mavsumsizPlan: boshlangich.mavsumsizPlan,
    planBonus: boshlangich.planBonus,
    boshlangichBall: boshlangich.boshlangichBall,
    kunlikLimit: boshlangich.kunlikLimit,
  });
  const [intervallar, setIntervallar] = useState<IntervalForm[]>(boshlangich.intervallar);
  const [qoidalar, setQoidalar] = useState<QoidaForm[]>(boshlangich.ballQoidalari);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  async function saqla() {
    setSaqlanmoqda(true);
    try {
      const res = await fetch("/api/hr/kpi/sozlamalar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...plan, intervallar, ballQoidalari: qoidalar }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Xatolik yuz berdi", tone: "error" });
        return;
      }
      toast({ message: "Sozlamalar saqlandi", tone: "success" });
    } catch {
      toast({ message: "Tarmoq xatosi — qayta urinib ko'ring", tone: "error" });
    } finally {
      setSaqlanmoqda(false);
    }
  }

  return (
    <div className="space-y-4">
      <IntervalTahrir intervallar={intervallar} onChange={setIntervallar} />
      <PlanTahrir qiymat={plan} onChange={setPlan} />
      <BallQoidaTahrir qoidalar={qoidalar} onChange={setQoidalar} />

      <div className="flex justify-end">
        <Button onClick={saqla} disabled={saqlanmoqda}>
          {saqlanmoqda ? "Saqlanmoqda..." : "Sozlamalarni saqlash"}
        </Button>
      </div>
    </div>
  );
}
