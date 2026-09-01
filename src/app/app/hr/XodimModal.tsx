"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { PLAN_TURLARI, PLAN_NOMI, type PlanTuri, type StavkaTuri } from "@/lib/validation/hr";
import { currentMonthString } from "@/lib/date";
import type { XodimDTO } from "@/lib/queries/hr";
import { XodimFormaMaydonlari, XODIM_INPUT } from "./XodimFormaMaydonlari";

export function XodimModal({
  xodim,
  onClose,
  onDone,
}: {
  xodim: XodimDTO | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const tahrir = xodim !== null;
  const [ism, setIsm] = useState(xodim?.ism ?? "");
  const [lavozim, setLavozim] = useState(xodim?.lavozim ?? "");
  const [tel, setTel] = useState(xodim?.tel ?? "");
  const [rasmUrl, setRasmUrl] = useState<string | null>(xodim?.rasmUrl ?? null);
  const [stavka, setStavka] = useState(xodim ? String(xodim.stavka) : "");
  const [stavkaTuri, setStavkaTuri] = useState<StavkaTuri>(
    (xodim?.stavkaTuri as StavkaTuri) ?? "oylik"
  );
  const [ishBoshlagan, setIshBoshlagan] = useState(
    xodim?.ishBoshlagan ? xodim.ishBoshlagan.slice(0, 10) : ""
  );
  const [izoh, setIzoh] = useState(xodim?.izoh ?? "");
  const [isActive, setIsActive] = useState(xodim?.isActive ?? true);
  // Plan — faqat YANGI xodimda shu yerdan belgilanadi (tahrirda "Plan" tugmasi bor).
  const [planTuri, setPlanTuri] = useState<PlanTuri>("zakaz");
  const [planMaqsad, setPlanMaqsad] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const son = Number(stavka || 0);
    if (!Number.isInteger(son) || son < 0) {
      setXato("Stavka manfiy bo'lmagan butun son bo'lishi kerak");
      return;
    }
    const plan = Number(planMaqsad || 0);
    if (!tahrir && planMaqsad && (!Number.isInteger(plan) || plan <= 0)) {
      setXato("Oylik plan musbat butun son bo'lishi kerak");
      return;
    }

    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(tahrir ? `/api/hr/xodimlar/${xodim!.id}` : "/api/hr/xodimlar", {
        method: tahrir ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ism,
          lavozim: lavozim || null,
          tel: tel || null,
          rasmUrl,
          stavka: son,
          stavkaTuri,
          ishBoshlagan: ishBoshlagan || null,
          izoh: izoh || null,
          ...(tahrir ? { isActive } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }

      // Yangi xodimga plan kiritilgan bo'lsa — joriy oy plani darhol yoziladi.
      if (!tahrir && plan > 0 && data.id) {
        const planRes = await fetch("/api/hr/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: data.id,
            oy: currentMonthString(),
            planTuri,
            maqsad: plan,
          }),
        });
        if (!planRes.ok) {
          const planData = await planRes.json().catch(() => ({}));
          setXato(
            `Xodim yaratildi, lekin plan yozilmadi: ${planData.error ?? "xatolik"}. Kartochkadagi "Plan" tugmasidan qayta belgilang.`
          );
          return;
        }
      }
      onDone();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  async function ochirish() {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/hr/xodimlar/${xodim!.id}`, { method: "DELETE" });
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
    <Modal open onClose={onClose} title={tahrir ? "Xodimni tahrirlash" : "Yangi xodim"}>
      <form onSubmit={submit} className="space-y-3">
        <XodimFormaMaydonlari
          ism={ism}
          setIsm={setIsm}
          lavozim={lavozim}
          setLavozim={setLavozim}
          tel={tel}
          setTel={setTel}
          rasmUrl={rasmUrl}
          setRasmUrl={setRasmUrl}
          stavka={stavka}
          setStavka={setStavka}
          stavkaTuri={stavkaTuri}
          setStavkaTuri={setStavkaTuri}
        />

        {!tahrir && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1" htmlFor="x-plan-turi">
                Plan turi
              </label>
              <Select
                id="x-plan-turi"
                value={planTuri}
                onChange={(v) => setPlanTuri(v as PlanTuri)}
                options={PLAN_TURLARI.map((t) => ({ value: t, label: PLAN_NOMI[t] }))}
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1" htmlFor="x-plan">
                Oylik plan (ixtiyoriy)
              </label>
              <input
                id="x-plan"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={planMaqsad}
                onChange={(e) => setPlanMaqsad(e.target.value)}
                className={XODIM_INPUT}
                placeholder={planTuri === "savdo" || planTuri === "kirim" ? "40000000" : "50"}
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="x-ish">
            Ishga kirgan sana
          </label>
          <input
            id="x-ish"
            type="date"
            value={ishBoshlagan}
            onChange={(e) => setIshBoshlagan(e.target.value)}
            className={XODIM_INPUT}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="x-izoh">
            Izoh
          </label>
          <input id="x-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} maxLength={500} className={XODIM_INPUT} />
        </div>

        {tahrir && (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
            Ishlayapti (nofaol xodim vedomostga tushmaydi)
          </label>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            {tahrir ? "Saqlash" : "Qo'shish"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          {tahrir && (
            <Button variant="ghost" onClick={ochirish} disabled={loading}>
              O&apos;chirish
            </Button>
          )}
        </div>
        {tahrir && (
          <p className="text-2xs text-faint">
            O&apos;chirilgan xodimning oylik va davomat tarixi saqlanadi.
          </p>
        )}
      </form>
    </Modal>
  );
}
