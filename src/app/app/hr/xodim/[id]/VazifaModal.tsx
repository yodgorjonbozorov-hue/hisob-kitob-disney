"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { MUHIMLIK_TURLARI, MUHIMLIK_NOMI, type Muhimlik } from "@/lib/validation/hr";
import type { XodimVazifaDTO } from "@/lib/services/xodimVazifa";

const INPUT = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

/** VAZIFA YARATISH/TAHRIRLASH — boshqaruvchi uchun. */
export function VazifaModal({
  employeeId,
  ism,
  vazifa,
  onClose,
  onDone,
}: {
  employeeId: string;
  ism: string;
  vazifa: XodimVazifaDTO | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const tahrir = vazifa !== null;
  const [nomi, setNomi] = useState(vazifa?.nomi ?? "");
  const [izoh, setIzoh] = useState(vazifa?.izoh ?? "");
  const [boshlanish, setBoshlanish] = useState(vazifa?.boshlanish ?? "");
  const [muddat, setMuddat] = useState(vazifa?.muddat ?? "");
  const [muhimlik, setMuhimlik] = useState<Muhimlik>((vazifa?.muhimlik as Muhimlik) ?? "orta");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(tahrir ? `/api/hr/vazifalar/${vazifa!.id}` : "/api/hr/vazifalar", {
        method: tahrir ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(tahrir ? {} : { employeeId }),
          nomi,
          izoh: izoh || null,
          boshlanish: boshlanish || null,
          muddat: muddat || null,
          muhimlik,
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

  async function ochirish() {
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/hr/vazifalar/${vazifa!.id}`, { method: "DELETE" });
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
    <Modal open onClose={onClose} title={tahrir ? "Vazifani tahrirlash" : `${ism} — yangi vazifa`}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="v-nomi">
            Vazifa nomi
          </label>
          <input id="v-nomi" value={nomi} onChange={(e) => setNomi(e.target.value)} required maxLength={200} className={INPUT} />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="v-izoh">
            Izoh
          </label>
          <textarea id="v-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} maxLength={1000} rows={2} className={INPUT} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="v-bosh">
              Boshlanish sanasi
            </label>
            <input id="v-bosh" type="date" value={boshlanish} onChange={(e) => setBoshlanish(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="v-muddat">
              Deadline
            </label>
            <input id="v-muddat" type="date" value={muddat} onChange={(e) => setMuddat(e.target.value)} className={INPUT} />
          </div>
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="v-muhim">
            Muhimlik
          </label>
          <Select
            id="v-muhim"
            value={muhimlik}
            onChange={(v) => setMuhimlik(v as Muhimlik)}
            options={MUHIMLIK_TURLARI.map((m) => ({ value: m, label: MUHIMLIK_NOMI[m] }))}
          />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            {tahrir ? "Saqlash" : "Vazifa berish"}
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
      </form>
    </Modal>
  );
}
