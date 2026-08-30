"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";

/**
 * XODIMLAR STATISTIKASI DAVR FILTRI: Bugun | Bu hafta | Bu oy | Sana.
 * Standart — "Bu oy". Sanalar foydalanuvchi qurilmasi kalendari bo'yicha
 * (O'zbekiston auditoriyasi — Toshkent), server ham xuddi shu "YYYY-MM-DD"
 * chegaralar bilan ishlaydi (lib/xodimDavr.ts).
 */

export type DavrTuri = "bugun" | "hafta" | "oy" | "sana";

export interface Davr {
  turi: DavrTuri;
  from: string;
  to: string;
}

function lokalSana(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const k = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${k}`;
}

/** Tayyor davr chegaralari (sana turi uchun joriy from/to saqlanadi). */
export function davrChegara(turi: Exclude<DavrTuri, "sana">): { from: string; to: string } {
  const bugun = new Date();
  const to = lokalSana(bugun);
  if (turi === "bugun") return { from: to, to };
  if (turi === "hafta") {
    // Dushanbadan boshlab (getDay: yakshanba=0).
    const kun = bugun.getDay() === 0 ? 6 : bugun.getDay() - 1;
    const dushanba = new Date(bugun);
    dushanba.setDate(bugun.getDate() - kun);
    return { from: lokalSana(dushanba), to };
  }
  return { from: `${to.slice(0, 7)}-01`, to };
}

export const BOSH_DAVR: Davr = { turi: "oy", ...davrChegara("oy") };

export function DavrFiltri({ davr, onChange }: { davr: Davr; onChange: (d: Davr) => void }) {
  // "Sana" rejimidagi qo'lda kiritilgan chegaralar (tasdiqlangunga qadar lokal).
  const [qolda, setQolda] = useState({ from: davr.from, to: davr.to });

  function turiAlmash(turi: DavrTuri) {
    if (turi === "sana") {
      setQolda({ from: davr.from, to: davr.to });
      onChange({ turi, from: davr.from, to: davr.to });
      return;
    }
    onChange({ turi, ...davrChegara(turi) });
  }

  function qoldaQollash(yangi: { from: string; to: string }) {
    setQolda(yangi);
    if (yangi.from && yangi.to) onChange({ turi: "sana", ...yangi });
  }

  return (
    <div className="space-y-3">
      <Segmented<DavrTuri>
        options={[
          { value: "bugun", label: "Bugun" },
          { value: "hafta", label: "Bu hafta" },
          { value: "oy", label: "Bu oy" },
          { value: "sana", label: "Sana" },
        ]}
        value={davr.turi}
        onChange={turiAlmash}
      />
      {davr.turi === "sana" && (
        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            aria-label="Boshlanish sanasi"
            value={qolda.from}
            max={qolda.to || undefined}
            onChange={(e) => qoldaQollash({ ...qolda, from: e.target.value })}
            className={INPUT_CLASS}
          />
          <input
            type="date"
            aria-label="Tugash sanasi"
            value={qolda.to}
            min={qolda.from || undefined}
            onChange={(e) => qoldaQollash({ ...qolda, to: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      )}
    </div>
  );
}
