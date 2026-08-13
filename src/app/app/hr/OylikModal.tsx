"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Money } from "@/components/ui/Money";
import { todayTashkentDateOnlyString } from "@/lib/date";
import type { OylikDTO } from "@/lib/queries/hr";

/** Oylikni hisoblash (ustama va ushlab qolish bilan) — pul yozuvi yozilmaydi. */
export function OylikModal({
  qator,
  oy,
  onClose,
  onDone,
}: {
  qator: OylikDTO;
  oy: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [qoshimcha, setQoshimcha] = useState(String(qator.qoshimcha || ""));
  const [ushlab, setUshlab] = useState(String(qator.ushlab || ""));
  const [izoh, setIzoh] = useState(qator.izoh ?? "");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = Number(qoshimcha || 0);
    const u = Number(ushlab || 0);
    if (!Number.isInteger(q) || q < 0 || !Number.isInteger(u) || u < 0) {
      setXato("Ustama va ushlab qolish manfiy bo'lmagan butun son bo'lishi kerak");
      return;
    }

    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/hr/oylik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: qator.employeeId,
          oy,
          qoshimcha: q,
          ushlab: u,
          izoh: izoh.trim() || null,
        }),
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

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";
  const asos =
    qator.stavkaTuri === "kunlik"
      ? Math.round((qator.stavka * qator.yarimKunlar) / 2)
      : qator.stavka;
  const taxminiy = Math.max(0, asos + Number(qoshimcha || 0) - Number(ushlab || 0) - qator.avans);

  return (
    <Modal open onClose={onClose} title={`${qator.xodimIsm} — ${oy} oyligi`}>
      <form onSubmit={submit} className="space-y-3">
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">
              Asos{qator.stavkaTuri === "kunlik" ? ` (${qator.yarimKunlar / 2} kun)` : ""}
            </span>
            <span className="tnum text-fg">{asos.toLocaleString("uz-UZ")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Berilgan avans</span>
            <span className="tnum text-expense">−{qator.avans.toLocaleString("uz-UZ")}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="o-qosh">
              Ustama / mukofot
            </label>
            <input
              id="o-qosh"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={qoshimcha}
              onChange={(e) => setQoshimcha(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="o-ushlab">
              Ushlab qolish
            </label>
            <input
              id="o-ushlab"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={ushlab}
              onChange={(e) => setUshlab(e.target.value)}
              className={input}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="o-izoh">
            Izoh
          </label>
          <input id="o-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} maxLength={300} className={input} />
        </div>

        <div className="flex items-center justify-between border-t border-line pt-2">
          <span className="text-sm text-muted">To&apos;lanadigan</span>
          <Money value={taxminiy} size="lg" tone="expense" />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <p className="text-2xs text-faint">
          Hisoblash pul yozuvi yaratmaydi — chiqim faqat &laquo;To&apos;lash&raquo; bosilganda
          yoziladi.
        </p>

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            Hisoblash
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Avans berish — pul DARHOL chiqadi. */
export function AvansModal({
  qator,
  oy,
  onClose,
  onDone,
}: {
  qator: OylikDTO;
  oy: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [summa, setSumma] = useState("");
  const [sana, setSana] = useState(todayTashkentDateOnlyString());
  const [izoh, setIzoh] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const son = Number(summa);
    if (!Number.isInteger(son) || son <= 0) {
      setXato("Avans musbat butun son bo'lishi kerak");
      return;
    }

    setLoading(true);
    setXato(null);
    try {
      const res = await fetch("/api/hr/avans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: qator.employeeId,
          oy,
          summa: son,
          sana,
          izoh: izoh.trim() || null,
        }),
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

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  return (
    <Modal open onClose={onClose} title={`${qator.xodimIsm} — avans (${oy})`}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="a-summa">
            Summa (so&apos;m)
          </label>
          <input
            id="a-summa"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={summa}
            onChange={(e) => setSumma(e.target.value)}
            required
            className={input}
          />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="a-sana">
            Sana
          </label>
          <input id="a-sana" type="date" value={sana} onChange={(e) => setSana(e.target.value)} required className={input} />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="a-izoh">
            Izoh
          </label>
          <input id="a-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} maxLength={300} className={input} />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <p className="text-2xs text-faint">
          Avans darhol chiqim sifatida yoziladi va {oy} oyligidan chegiriladi — bir xil pul ikki
          marta chiqim bo&apos;lib ko&apos;rinmaydi.
        </p>

        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="danger" loading={loading}>
            Avans berish
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
