"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ACCOUNT_TURLARI, ACCOUNT_TURI_NOMI } from "@/lib/validation/account";
import type { AccountQoldiq } from "@/lib/queries/accounts";

const input =
  "w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-surface-2 border border-line text-fg " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/**
 * YANGI KASSA / KASSANI TAHRIRLASH — faqat boshqaruvchi (server ham tekshiradi).
 *
 * Maydonlar mavjud sxema ruxsat berganicha: nomi, turi, tartib va faollik.
 * MAS'UL XODIM bu yerda tanlanmaydi — shaxsiy kassa xodimga "Kassa
 * sozlamalari → Shaxsiy kassa rejimi" orqali biriktiriladi, aks holda bitta
 * xodimga ikki xil yo'l bilan ikkita kassa ochilib qolardi.
 */
export function KassaModal({
  kassa,
  onClose,
  onDone,
}: {
  kassa: AccountQoldiq | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const tahrir = kassa !== null;
  const [nomi, setNomi] = useState(kassa?.nomi ?? "");
  const [turi, setTuri] = useState(kassa?.turi ?? "naqd");
  const [tartib, setTartib] = useState(String(kassa?.tartib ?? 0));
  const [isActive, setIsActive] = useState(kassa?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    const raqam = parseInt(tartib, 10);
    const tartibQiymat = Number.isFinite(raqam) ? Math.min(Math.max(raqam, 0), 999) : 0;
    try {
      const res = await fetch(tahrir ? `/api/accounts/${kassa!.id}` : "/api/accounts", {
        method: tahrir ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tahrir
            ? { nomi, turi, isActive, tartib: tartibQiymat }
            : { nomi, turi, tartib: tartibQiymat }
        ),
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
    if (!confirm("Kassa butunlay o'chirilsinmi?")) return;
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(`/api/accounts/${kassa!.id}`, { method: "DELETE" });
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
    <Modal open onClose={onClose} title={tahrir ? "Kassani tahrirlash" : "Yangi kassa"}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="kassa-nomi">
            Kassa nomi
          </label>
          <input
            id="kassa-nomi"
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            required
            maxLength={60}
            placeholder="Masalan: Asosiy kassa"
            className={input}
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="kassa-turi">
            Turi
          </label>
          <Select
            id="kassa-turi"
            value={turi}
            onChange={setTuri}
            options={ACCOUNT_TURLARI.map((t) => ({ value: t, label: ACCOUNT_TURI_NOMI[t] }))}
          />
          <p className="text-2xs text-faint mt-1">
            Naqd — qo&apos;ldagi pul, Plastik — terminal, Bank — hisob-raqam. Yangi yozuv
            to&apos;lov turiga mos kassaga tushadi.
          </p>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="kassa-tartib">
            Ro&apos;yxatdagi tartibi
          </label>
          <input
            id="kassa-tartib"
            inputMode="numeric"
            value={tartib}
            onChange={(e) => setTartib(e.target.value)}
            className={input}
          />
        </div>

        {tahrir && kassa?.userId && (
          <p className="text-2xs text-muted">
            Mas&apos;ul xodim: <span className="text-fg font-medium">{kassa.egaIsm ?? "—"}</span> —
            shaxsiy kassa rejimi orqali biriktirilgan.
          </p>
        )}

        {tahrir && (
          <label className="flex items-center gap-2 text-sm text-fg min-h-[44px]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5"
            />
            Faol (yangi yozuv va o&apos;tkazmalarda ko&apos;rinadi)
          </label>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" loading={loading}>
            {tahrir ? "Saqlash" : "Ochish"}
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
            Yozuvi bor kassani o&apos;chirib bo&apos;lmaydi — uni nofaol qiling, tarix saqlanadi.
          </p>
        )}
      </form>
    </Modal>
  );
}
