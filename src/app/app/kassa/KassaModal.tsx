"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ACCOUNT_TURLARI, ACCOUNT_TURI_NOMI } from "@/lib/validation/account";
import type { AccountQoldiq } from "@/lib/queries/accounts";

/** Yangi kassa ochish yoki mavjudini tahrirlash. */
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
  const [isActive, setIsActive] = useState(kassa?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(tahrir ? `/api/accounts/${kassa!.id}` : "/api/accounts", {
        method: tahrir ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tahrir ? { nomi, turi, isActive } : { nomi, turi }),
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
            Nomi
          </label>
          <input
            id="kassa-nomi"
            value={nomi}
            onChange={(e) => setNomi(e.target.value)}
            required
            maxLength={60}
            placeholder="Masalan: Asosiy kassa"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="kassa-turi">
            Turi
          </label>
          <select
            id="kassa-turi"
            value={turi}
            onChange={(e) => setTuri(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg"
          >
            {ACCOUNT_TURLARI.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TURI_NOMI[t]}
              </option>
            ))}
          </select>
        </div>

        {tahrir && (
          <label className="flex items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4"
            />
            Faol (yangi yozuvlarda ko&apos;rinadi)
          </label>
        )}

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            {tahrir ? "Saqlash" : "Ochish"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          {tahrir && (
            <Button type="button" variant="ghost" onClick={ochirish} disabled={loading}>
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
