"use client";

import { useEffect, useState } from "react";
import { formatSom, parseSomInput } from "@/lib/format";
import { formatKgLabel, kgSumma, kgToGram, parseKgInput } from "@/lib/kg";

/** Kg savdosining hisoblangan qiymatlari (jami — faqat ko'rsatish uchun). */
export interface KgQiymat {
  miqdorKg: number;
  kgNarxi: number;
  jami: number;
}

export const KG_BOSH: KgQiymat = { miqdorKg: 0, kgNarxi: 0, jami: 0 };

/**
 * KG SAVDOSI MAYDONLARI (mijozga xos — Fortex Selos).
 *
 * Kg kategoriyasi tanlanganda summa maydoni o'rniga chiqadi: miqdor (kg),
 * 1 kg narxi va hisoblangan jami. Narx QOTIRILMAGAN — har savdoda erkin
 * kiritiladi; server jamini baribir qayta hisoblaydi (lib/kg.ts).
 */
export function KgMaydonlari({
  onChange,
  tozalash = 0,
}: {
  onChange: (q: KgQiymat) => void;
  /** Qiymat o'zgarganda maydonlar tozalanadi (saqlangandan keyin). */
  tozalash?: number;
}) {
  const [miqdorText, setMiqdorText] = useState("");
  const [kgNarxText, setKgNarxText] = useState("");

  useEffect(() => {
    setMiqdorText("");
  }, [tozalash]);

  const miqdorKg = parseKgInput(miqdorText);
  const kgNarxi = parseSomInput(kgNarxText);
  const jami = miqdorKg > 0 && kgNarxi > 0 ? kgSumma(kgToGram(miqdorKg), kgNarxi) : 0;

  useEffect(() => {
    onChange({ miqdorKg, kgNarxi, jami });
    // `onChange` har renderda yangi funksiya bo'lishi mumkin — faqat
    // qiymatlar o'zgarganda xabar beriladi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miqdorKg, kgNarxi, jami]);

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Miqdor (kg)</label>
        <input
          type="text"
          inputMode="decimal"
          value={miqdorText}
          onChange={(e) => setMiqdorText(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="100"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm tnum"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">1 kg narxi (soʻm)</label>
        <input
          type="text"
          inputMode="numeric"
          value={kgNarxText}
          onChange={(e) => setKgNarxText(formatSom(parseSomInput(e.target.value)))}
          placeholder="5 000"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm tnum"
        />
      </div>
      <div className="sm:col-span-2 text-sm text-muted tnum">
        Jami: <span className="font-medium text-income">{formatSom(jami)} soʻm</span>
        {miqdorKg > 0 && kgNarxi > 0 && (
          <span className="text-faint">
            {" "}
            ({formatKgLabel(kgToGram(miqdorKg))} × {formatSom(kgNarxi)})
          </span>
        )}
      </div>
    </>
  );
}
