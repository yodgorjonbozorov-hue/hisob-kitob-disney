"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ModulKarta {
  code: string;
  nomi: string;
  tavsif: string;
  core: boolean;
  tarifdaBor: boolean;
  yoqilgan: boolean;
  /** Modul yoqiq, ammo ishlashi uchun yana bir sozlama kerak bo'lsa — sabab matni. */
  ogohlantirish?: string;
  /**
   * Yoqishdan oldin tasdiq so'raladigan modullarda — "nima qo'shiladi"
   * ro'yxati (lib/modules/registry.ts dagi `qoshiladi`).
   */
  qoshiladi?: string[];
}

export function ModullarClient({ kartalar }: { kartalar: ModulKarta[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [tasdiq, setTasdiq] = useState<ModulKarta | null>(null);

  async function yoqOchir(m: ModulKarta, isActive: boolean) {
    setBusy(m.code);
    setXato(null);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: m.code, isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXato(data.error ?? "Xatolik yuz berdi");
        return;
      }
      setTasdiq(null);
      router.refresh();
    } catch {
      setXato("Serverga ulanib bo'lmadi");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Yoqishda tasdiq so'ralishi mumkin: modul bir nechta yangi bo'lim
   * qo'shsa (masalan MAGAZIN — kassa, QR, cheklar), foydalanuvchi nima
   * o'zgarishini OLDINDAN ko'rishi kerak. O'chirishda tasdiq so'ralmaydi:
   * o'chirish ma'lumotga tegmaydi va bir bosishda qaytariladi.
   */
  function toggle(m: ModulKarta) {
    if (!m.yoqilgan && m.qoshiladi?.length) {
      setXato(null);
      setTasdiq(m);
      return;
    }
    void yoqOchir(m, !m.yoqilgan);
  }

  return (
    <div className="space-y-3">
      {xato && !tasdiq && (
        <div className="rounded-xl border border-expense/40 bg-expense-soft text-expense-fg px-4 py-3 text-sm">
          {xato}
        </div>
      )}
      {kartalar.map((m) => (
        <div key={m.code} className="bg-surface rounded-2xl border border-line p-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-fg">{m.nomi}</h2>
              {m.core && (
                <span className="text-2xs px-2 py-0.5 rounded-full bg-surface-2 text-muted">asosiy</span>
              )}
              {!m.tarifdaBor && (
                <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-wash text-brand">yuqori tarifda</span>
              )}
            </div>
            <p className="text-sm text-muted mt-1">{m.tavsif}</p>
            {m.ogohlantirish && (
              <p className="text-xs text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2 mt-2">
                {m.ogohlantirish}
              </p>
            )}
          </div>
          {m.core ? (
            <span className="text-xs text-faint shrink-0 mt-1">doim yoqiq</span>
          ) : (
            <button
              onClick={() => toggle(m)}
              disabled={busy === m.code || (!m.yoqilgan && !m.tarifdaBor)}
              aria-label={`${m.nomi} modulini ${m.yoqilgan ? "o'chirish" : "yoqish"}`}
              className={`relative shrink-0 w-11 h-6 rounded-full transition disabled:opacity-40 ${
                m.yoqilgan ? "bg-income" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  m.yoqilgan ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          )}
        </div>
      ))}

      {tasdiq && (
        <Modal open onClose={() => setTasdiq(null)} title={`${tasdiq.nomi} modulini yoqmoqchimisiz?`}>
          <div className="space-y-4">
            <p className="text-sm text-muted">{tasdiq.tavsif}</p>
            <div>
              <p className="text-sm font-medium text-fg mb-2">Nimalar qo&apos;shiladi:</p>
              <ul className="space-y-1">
                {tasdiq.qoshiladi?.map((q) => (
                  <li key={q} className="text-sm text-muted flex gap-2">
                    <span className="text-income shrink-0">✓</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-faint">
              Mavjud ma&apos;lumotlaringizga tegilmaydi. Modulni istalgan vaqtda qayta
              o&apos;chirishingiz mumkin — o&apos;chirilganda ham hech narsa yo&apos;qolmaydi.
            </p>
            {xato && (
              <p className="text-sm text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
                {xato}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setTasdiq(null)} disabled={busy === tasdiq.code}>
                Bekor qilish
              </Button>
              <Button onClick={() => yoqOchir(tasdiq, true)} loading={busy === tasdiq.code}>
                Yoqish
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
