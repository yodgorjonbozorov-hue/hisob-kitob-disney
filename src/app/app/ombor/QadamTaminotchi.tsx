"use client";

import { useMemo, useState } from "react";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { YangiTaminotchi, type TaminotchiQisqa } from "./YangiTaminotchi";

/**
 * 1-QADAM — KIMDAN KELDI?
 *
 * Bitta savol, bitta javob. Ro'yxat brauzerda filtrlanadi: ta'minotchilar
 * odatda o'nlab, mahsulotlar esa minglab bo'ladi — server qidiruvi bu yerda
 * ortiqcha kechikish qo'shardi (mahsulotlarda esa aksincha, u yerda server
 * qidiruvi ishlatiladi).
 */
export function QadamTaminotchi({
  taminotchilar,
  tanlanganId,
  onTanla,
  onQoshildi,
}: {
  taminotchilar: TaminotchiQisqa[];
  tanlanganId: string | null;
  onTanla: (t: TaminotchiQisqa) => void;
  /** Yangi ta'minotchi yaratildi — chaqiruvchi ro'yxatni yangilaydi. */
  onQoshildi: (t: TaminotchiQisqa) => void;
}) {
  const [q, setQ] = useState("");
  const [yangi, setYangi] = useState(false);

  const korinadigan = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return taminotchilar;
    return taminotchilar.filter((t) => t.nomi.toLowerCase().includes(s));
  }, [q, taminotchilar]);

  if (yangi) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Yangi ta&apos;minotchi</p>
        <YangiTaminotchi
          boshlangichNomi={q.trim()}
          onBekor={() => setYangi(false)}
          onDone={(t) => {
            setYangi(false);
            onQoshildi(t);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-fg">Kimdan keldi?</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ta'minotchini tanlang..."
        className={INPUT_CLASS}
      />

      <div className="max-h-64 overflow-y-auto rounded-xl border border-line divide-y divide-line">
        {korinadigan.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTanla(t)}
            className={`w-full px-3 py-3 text-left text-sm transition flex items-center justify-between gap-2 ${
              t.id === tanlanganId ? "bg-brand-wash text-brand font-medium" : "hover:bg-surface-2"
            }`}
          >
            <span className="truncate">{t.nomi}</span>
            {t.id === tanlanganId && <span aria-hidden>&#10003;</span>}
          </button>
        ))}

        {korinadigan.length === 0 && (
          <p className="px-3 py-4 text-sm text-center text-faint">
            {taminotchilar.length === 0 ? "Hali ta'minotchi yo'q" : "Topilmadi"}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setYangi(true)}
        className="w-full text-sm text-brand font-medium py-2.5 rounded-lg hover:bg-brand-wash transition"
      >
        + Yangi ta&apos;minotchi{q.trim() ? `: "${q.trim()}"` : ""}
      </button>
    </div>
  );
}
