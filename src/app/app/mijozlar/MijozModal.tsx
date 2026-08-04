"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { MijozDTO } from "@/lib/queries/mijoz";

/**
 * Mijoz qo'shish/tahrirlash. Qarz limiti bo'sh qoldirilsa — chegara yo'q;
 * 0 yozilsa mijozga umuman qarzga sotilmaydi.
 */
export function MijozModal({
  mijoz,
  boshqaruvchi,
  onClose,
  onDone,
  onDeleted,
}: {
  mijoz: MijozDTO | null;
  boshqaruvchi: boolean;
  onClose: () => void;
  onDone: () => void;
  /** O'chirilgandan keyin — berilmasa `onDone` chaqiriladi. */
  onDeleted?: () => void;
}) {
  const tahrir = mijoz !== null;
  const [ism, setIsm] = useState(mijoz?.ism ?? "");
  const [tel, setTel] = useState(mijoz?.tel ?? "");
  const [telegram, setTelegram] = useState(mijoz?.telegram ?? "");
  const [izoh, setIzoh] = useState(mijoz?.izoh ?? "");
  const [limit, setLimit] = useState(mijoz?.qarzLimit === null || mijoz === null ? "" : String(mijoz.qarzLimit));
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    let qarzLimit: number | null = null;
    if (limit.trim() !== "") {
      const son = Number(limit);
      if (!Number.isInteger(son) || son < 0) {
        setXato("Qarz limiti manfiy bo'lmagan butun son bo'lishi kerak");
        return;
      }
      qarzLimit = son;
    }

    setLoading(true);
    setXato(null);
    try {
      const res = await fetch(tahrir ? `/api/mijozlar/${mijoz!.id}` : "/api/mijozlar", {
        method: tahrir ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ism,
          tel: tel || null,
          telegram: telegram || null,
          izoh: izoh || null,
          ...(boshqaruvchi ? { qarzLimit } : {}),
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
      const res = await fetch(`/api/mijozlar/${mijoz!.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "O'chirib bo'lmadi");
        return;
      }
      (onDeleted ?? onDone)();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

  return (
    <Modal open onClose={onClose} title={tahrir ? "Mijozni tahrirlash" : "Yangi mijoz"}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="m-ism">
            Ism / kompaniya
          </label>
          <input id="m-ism" value={ism} onChange={(e) => setIsm(e.target.value)} required maxLength={120} className={input} />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="m-tel">
            Telefon
          </label>
          <input id="m-tel" value={tel} onChange={(e) => setTel(e.target.value)} maxLength={50} className={input} />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="m-tg">
            Telegram
          </label>
          <input id="m-tg" value={telegram} onChange={(e) => setTelegram(e.target.value)} maxLength={80} className={input} />
        </div>

        {boshqaruvchi && (
          <div>
            <label className="block text-sm text-muted mb-1" htmlFor="m-limit">
              Qarz limiti (so&apos;m)
            </label>
            <input
              id="m-limit"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Bo'sh — chegara yo'q"
              className={input}
            />
            <p className="text-2xs text-faint mt-1">
              Ochiq qarz shu chegaraga yetsa yangi qarzga sotuv rad etiladi. 0 — umuman qarzga
              sotilmaydi.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="m-izoh">
            Izoh
          </label>
          <input id="m-izoh" value={izoh} onChange={(e) => setIzoh(e.target.value)} maxLength={500} className={input} />
        </div>

        {xato && <p className="text-sm text-expense">{xato}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" loading={loading}>
            {tahrir ? "Saqlash" : "Qo'shish"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          {tahrir && boshqaruvchi && (
            <Button variant="ghost" onClick={ochirish} disabled={loading}>
              O&apos;chirish
            </Button>
          )}
        </div>
        {tahrir && (
          <p className="text-2xs text-faint">
            O&apos;chirilgan mijozning sotuv va qarz tarixi saqlanadi. Yopilmagan qarzi bor mijoz
            o&apos;chirilmaydi.
          </p>
        )}
      </form>
    </Modal>
  );
}
