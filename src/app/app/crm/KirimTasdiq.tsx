"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import type { BuyurtmaDTO } from "./turlar";

/**
 * KIRIMGA O'TKAZISH TASDIG'I (4-talab).
 *
 * Pul yozadigan amal, shuning uchun brauzerning `confirm()` i emas — summa
 * va kategoriya ko'rinib turadigan alohida oyna.
 */
export function KirimTasdiq({
  b,
  onClose,
  onDone,
}: {
  b: BuyurtmaDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function otkazish() {
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${b.id}/kirim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Kirim yozilmadi");
      return;
    }
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-3"
      >
        <h3 className="font-semibold text-fg">Kirimga o&apos;tkazish</h3>
        <p className="text-sm text-muted">
          Bu buyurtma uchun <span className="font-semibold text-fg tnum">{formatMoney(b.summa)}</span> kirim
          yozilsinmi?
        </p>
        <ul className="text-xs text-muted space-y-0.5 border-l-2 border-line pl-3">
          <li>Kategoriya: {b.kategoriya ?? "Sotuv"}</li>
          <li>Izoh: {b.kontakt ? `${b.nomi} — ${b.kontakt}` : b.nomi}</li>
          <li>Manba: CRM buyurtma</li>
        </ul>
        <p className="text-2xs text-faint">
          Kirim bir marta yoziladi — keyin bu tugma o&apos;chadi.
        </p>
        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line text-sm text-muted">
            Bekor
          </button>
          <button
            onClick={otkazish}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-income text-white text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Yozilmoqda..." : "Ha, kirim yoz"}
          </button>
        </div>
      </div>
    </div>
  );
}
