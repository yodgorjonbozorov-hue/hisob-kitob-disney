"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { PLAN_TURLARI, PLAN_NOMI, type PlanTuri } from "@/lib/validation/hr";
import type { PlanDTO } from "@/lib/queries/xodimPlan";

const INPUT = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

/**
 * PLAN BELGILASH — bir xodim + bir oy uchun (upsert). Faqat shu oy yozuvi
 * o'zgaradi, o'tgan oylar statistikasi tegilmaydi.
 */
export function PlanModal({
  employeeId,
  ism,
  oy,
  plan,
  userIdBor,
  onClose,
  onDone,
}: {
  employeeId: string;
  ism: string;
  oy: string;
  plan: PlanDTO | null;
  /** Xodim tizim hisobiga bog'langanmi — zakaz/savdo/kirim planlari shunga tayanadi. */
  userIdBor: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [planTuri, setPlanTuri] = useState<PlanTuri>(plan?.planTuri ?? "zakaz");
  const [maqsad, setMaqsad] = useState(plan ? String(plan.maqsad) : "");
  const [izoh, setIzoh] = useState(plan?.izoh ?? "");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const summali = planTuri === "savdo" || planTuri === "kirim";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const son = Number(maqsad);
    if (!Number.isInteger(son) || son <= 0) {
      setXato("Plan musbat butun son bo'lishi kerak");
      return;
    }
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/hr/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, oy, planTuri, maqsad: son, izoh: izoh || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  async function ochirish() {
    if (!plan) return;
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/hr/plan/${plan.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "O'chirib bo'lmadi");
        return;
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${ism} — ${oy} plani`}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="p-turi">
            Plan turi
          </label>
          <Select
            id="p-turi"
            value={planTuri}
            onChange={(v) => setPlanTuri(v as PlanTuri)}
            options={PLAN_TURLARI.map((t) => ({ value: t, label: PLAN_NOMI[t] }))}
          />
        </div>

        {!userIdBor && planTuri !== "vazifa" && (
          <p className="text-2xs text-warning">
            Bu xodim tizim hisobiga bog&apos;lanmagan — zakaz/savdo/kirim natijasi 0 bo&apos;lib
            qoladi. Avval xodimni foydalanuvchi hisobiga bog&apos;lang yoki &laquo;Vazifa
            soni&raquo; planidan foydalaning.
          </p>
        )}

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="p-maqsad">
            Oylik plan {summali ? "(so'm)" : "(dona)"}
          </label>
          <input
            id="p-maqsad"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={maqsad}
            onChange={(e) => setMaqsad(e.target.value)}
            required
            className={INPUT}
            placeholder={summali ? "40000000" : "50"}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="p-izoh">
            Izoh
          </label>
          <input id="p-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} maxLength={300} className={INPUT} />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            Saqlash
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          {plan && (
            <Button variant="ghost" onClick={ochirish} disabled={loading}>
              Planni o&apos;chirish
            </Button>
          )}
        </div>
        <p className="text-2xs text-faint">
          Natija avtomatik hisoblanadi: zakaz/savdo — kirim yozuvlaridan, kirim — kelib tushgan
          puldan, vazifa — bajarilgan vazifalardan. Har oy plani alohida saqlanadi.
        </p>
      </form>
    </Modal>
  );
}
