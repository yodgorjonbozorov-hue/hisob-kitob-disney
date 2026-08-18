"use client";

import { useState } from "react";

export interface SanaOraliq {
  /** "YYYY-MM-DD" yoki null (chegarasiz). */
  from: string | null;
  to: string | null;
}

export type SanaPreset = "oy" | "bugun" | "kecha" | "hafta" | "hammasi" | "custom";

/** Bugundan `kun` kun oldingi sana, "YYYY-MM-DD" (UTC — sanalar shu o'lchamda). */
function kunOldin(kun: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - kun);
  return d.toISOString().slice(0, 10);
}

/**
 * Preset tanlanganda hosil bo'ladigan oraliq.
 *
 * "Oy" — bosh sahifada TANLANGAN oy (joriy oy bo'lishi shart emas): tafsilot
 * kartadagi summa bilan bir xil davrni ko'rsatishi kerak.
 */
export function presetOraliq(preset: SanaPreset, oy: SanaOraliq): SanaOraliq {
  switch (preset) {
    case "oy":
      return oy;
    case "bugun":
      return { from: kunOldin(0), to: kunOldin(0) };
    case "kecha":
      return { from: kunOldin(1), to: kunOldin(1) };
    case "hafta":
      return { from: kunOldin(6), to: kunOldin(0) };
    case "hammasi":
      return { from: null, to: null };
    default:
      return oy;
  }
}

const TUGMALAR: { kod: SanaPreset; nomi: string }[] = [
  { kod: "bugun", nomi: "Bugun" },
  { kod: "kecha", nomi: "Kecha" },
  { kod: "hafta", nomi: "Bu hafta" },
  { kod: "hammasi", nomi: "Butun davr" },
  { kod: "custom", nomi: "Sana tanlash" },
];

/**
 * SANA FILTRI — presetlar va qo'lda oraliq.
 *
 * Birinchi tugma ataylab tanlangan OY nomi bilan ataladi ("Avgust 2026"):
 * foydalanuvchi oynani ochganda qaysi davr raqami turganini darhol ko'rsin.
 */
export function KategoriyaSanaFiltr({
  preset,
  oraliq,
  oyNomi,
  onChange,
}: {
  preset: SanaPreset;
  oraliq: SanaOraliq;
  oyNomi: string;
  onChange: (preset: SanaPreset, oraliq: SanaOraliq) => void;
}) {
  const [ochiq, setOchiq] = useState(preset === "custom");

  function tanla(kod: SanaPreset, oy: SanaOraliq) {
    if (kod === "custom") {
      setOchiq(true);
      onChange("custom", oraliq);
      return;
    }
    setOchiq(false);
    onChange(kod, presetOraliq(kod, oy));
  }

  const oyOraliq = preset === "oy" ? oraliq : { from: null, to: null };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {[{ kod: "oy" as SanaPreset, nomi: oyNomi }, ...TUGMALAR].map((t) => (
          <button
            key={t.kod}
            type="button"
            onClick={() => tanla(t.kod, oyOraliq)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-2xs font-medium transition ${
              preset === t.kod ? "bg-brand text-white" : "bg-surface-2 text-muted hover:text-fg"
            }`}
          >
            {t.nomi}
          </button>
        ))}
      </div>

      {ochiq && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={oraliq.from ?? ""}
            onChange={(e) => onChange("custom", { ...oraliq, from: e.target.value || null })}
            className="flex-1 min-w-0 rounded-lg border border-line px-2 py-1.5 text-xs"
            aria-label="Boshlanish sanasi"
          />
          <span className="text-faint text-xs">—</span>
          <input
            type="date"
            value={oraliq.to ?? ""}
            onChange={(e) => onChange("custom", { ...oraliq, to: e.target.value || null })}
            className="flex-1 min-w-0 rounded-lg border border-line px-2 py-1.5 text-xs"
            aria-label="Tugash sanasi"
          />
        </div>
      )}
    </div>
  );
}
