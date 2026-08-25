"use client";

import { Plus, Trash2, X } from "lucide-react";
import { formatRelativeDay } from "@/lib/format";
import type { SuhbatQator } from "./turlar";

/**
 * CHAT TARIXI.
 *
 * Kengroq ekranda (xl+) doimiy yon panel, undan kichikda — chapdan
 * ochiladigan drawer. Ro'yxat kun bo'yicha guruhlanadi ("Bugun", "Kecha",
 * sana), chunki suhbat nomi qisqa va o'xshash bo'lishi mumkin.
 *
 * Ro'yxat FAQAT shu foydalanuvchining shu biznesdagi suhbatlari —
 * server so'rovi (businessId + userId) shu bilan cheklangan.
 */
export function SuhbatlarPanel({
  suhbatlar,
  joriyId,
  ochiq,
  onYopish,
  onTanlash,
  onOchirish,
  onYangi,
}: {
  suhbatlar: SuhbatQator[];
  joriyId: string | null;
  ochiq: boolean;
  onYopish: () => void;
  onTanlash: (id: string) => void;
  onOchirish: (id: string) => void;
  onYangi: () => void;
}) {
  const guruhlar = guruhla(suhbatlar);

  const royxat = (
    <>
      <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-line xl:border-0">
        <button
          onClick={onYangi}
          className="flex-1 inline-flex items-center gap-2 px-3 h-10 rounded-lg border border-line text-sm text-fg hover:border-brand hover:text-brand transition"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Yangi suhbat
        </button>
        <button
          onClick={onYopish}
          aria-label="Yopish"
          className="xl:hidden w-10 h-10 rounded-lg flex items-center justify-center text-muted hover:bg-surface-2"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {suhbatlar.length === 0 && (
          <p className="px-2 py-3 text-xs text-faint">Hozircha suhbat yo&apos;q.</p>
        )}
        {guruhlar.map(([sarlavha, qatorlar]) => (
          <div key={sarlavha} className="space-y-0.5">
            <p className="px-2 text-2xs font-medium uppercase tracking-wide text-faint">{sarlavha}</p>
            {qatorlar.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-1 rounded-lg ${
                  s.id === joriyId ? "bg-surface-2" : "hover:bg-surface-2"
                }`}
              >
                <button
                  onClick={() => onTanlash(s.id)}
                  className="flex-1 min-w-0 text-left px-2.5 py-2 text-xs text-fg truncate min-h-[40px]"
                >
                  {s.sarlavha}
                </button>
                <button
                  onClick={() => onOchirish(s.id)}
                  aria-label="Suhbatni o'chirish"
                  className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-faint hover:text-expense-fg xl:opacity-0 xl:group-hover:opacity-100 transition"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden xl:flex w-60 shrink-0 flex-col rounded-2xl border border-line bg-surface overflow-hidden">
        {royxat}
      </aside>

      {ochiq && (
        <div className="xl:hidden fixed inset-0 z-50 flex animate-fade-in" role="dialog" aria-label="Suhbatlar tarixi">
          <div className="absolute inset-0 bg-black/50" onClick={onYopish} />
          <div className="relative w-[80%] max-w-[300px] h-full bg-surface flex flex-col shadow-raised">
            {royxat}
          </div>
        </div>
      )}
    </>
  );
}

/** Suhbatlarni kun bo'yicha guruhlaydi (yangisi birinchi). */
function guruhla(suhbatlar: SuhbatQator[]): Array<[string, SuhbatQator[]]> {
  const map = new Map<string, SuhbatQator[]>();
  for (const s of suhbatlar) {
    const kun = formatRelativeDay(new Date(s.yangilangan));
    const royxat = map.get(kun) ?? [];
    royxat.push(s);
    map.set(kun, royxat);
  }
  return [...map.entries()];
}
