"use client";

import { useEffect, useRef, useState } from "react";
import { formatSomLabel } from "@/lib/format";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import {
  CHIQIM_SHAXS_TARTIBI,
  KIRIM_SHAXS_TARTIBI,
  SHAXS_KIMDAN,
  kartochkaliMi,
  type ShaxsTuri,
} from "@/lib/moliya/shaxs";
import type { TanlanganShaxs } from "./turlar";

interface Taklif {
  turi: ShaxsTuri;
  id: string;
  ism: string;
  tavsif: string | null;
  qarz: number;
}

/**
 * "PUL KIMDAN OLINDI / KIMGA BERILDI" — bitta qadam.
 *
 * Ikki qism: TUR (mijoz, ta'minotchi, xodim...) va shu turdagi ODAM.
 * Kartochkali turlarda bazadan qidiruv ochiladi va har taklif yonida uning
 * JORIY QARZI ko'rinadi — kassir kimni tanlayotganini ro'yxatning o'zidayoq
 * ko'radi. Kartochkasiz turlarda (usta, filial) oddiy matn maydoni qoladi:
 * har kishi uchun kartochka ochishni talab qilish kundalik ishni
 * sekinlashtirardi.
 */
export function ShaxsTanlash({
  yonalish,
  qiymat,
  onChange,
  disabled,
}: {
  yonalish: "kirim" | "chiqim";
  qiymat: TanlanganShaxs;
  onChange: (v: TanlanganShaxs) => void;
  disabled?: boolean;
}) {
  const [takliflar, setTakliflar] = useState<Taklif[]>([]);
  const [ochiq, setOchiq] = useState(false);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const turlar = yonalish === "kirim" ? KIRIM_SHAXS_TARTIBI : CHIQIM_SHAXS_TARTIBI;
  const kartochkali = kartochkaliMi(qiymat.turi);

  useEffect(() => {
    if (!ochiq || !kartochkali) return;
    const t = setTimeout(async () => {
      setYuklanmoqda(true);
      try {
        const res = await fetch(
          `/api/moliya/shaxslar?turi=${qiymat.turi}&q=${encodeURIComponent(qiymat.ism)}`
        );
        setTakliflar(res.ok ? await res.json() : []);
      } catch {
        setTakliflar([]);
      } finally {
        setYuklanmoqda(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [qiymat.turi, qiymat.ism, ochiq, kartochkali]);

  useEffect(() => {
    function tashqari(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOchiq(false);
    }
    document.addEventListener("mousedown", tashqari);
    return () => document.removeEventListener("mousedown", tashqari);
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <span className={LABEL_CLASS}>
          {yonalish === "kirim" ? "Pul kimdan olindi?" : "Pul kimga berildi?"}
        </span>
        {/* Tugmalar to'ri — mobil'da barmoq bilan bir bosishda tanlanadi. */}
        <div className="grid grid-cols-3 gap-2">
          {turlar.map((t) => (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange({ turi: t, id: null, ism: "", qarz: undefined });
                setTakliflar([]);
              }}
              className={`min-h-[44px] rounded-lg border px-2 text-sm transition ${
                qiymat.turi === t
                  ? "border-brand bg-brand-wash text-brand font-medium"
                  : "border-line text-muted hover:border-line-strong"
              }`}
            >
              {SHAXS_KIMDAN[t]}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative">
        <label className={LABEL_CLASS} htmlFor="moliya-shaxs">
          {SHAXS_KIMDAN[qiymat.turi]} <span className="text-expense">*</span>
        </label>
        <input
          id="moliya-shaxs"
          type="text"
          value={qiymat.ism}
          disabled={disabled}
          autoComplete="off"
          placeholder={kartochkali ? "Qidiring yoki ism yozing" : "Ismini yozing"}
          onChange={(e) => onChange({ turi: qiymat.turi, id: null, ism: e.target.value })}
          onFocus={() => setOchiq(true)}
          className={INPUT_CLASS}
        />

        {ochiq && kartochkali && (
          <div className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-line bg-surface shadow-card">
            {yuklanmoqda && takliflar.length === 0 && (
              <p className="px-3 py-2 text-xs text-faint">Qidirilmoqda...</p>
            )}
            {!yuklanmoqda && takliflar.length === 0 && (
              <p className="px-3 py-2 text-xs text-faint">
                Topilmadi — ismni qo&apos;lda yozsangiz ham bo&apos;ladi
              </p>
            )}
            {takliflar.map((s) => (
              <button
                key={`${s.turi}:${s.id}`}
                type="button"
                onClick={() => {
                  onChange({ turi: s.turi, id: s.id, ism: s.ism, qarz: s.qarz });
                  setOchiq(false);
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-surface-2 border-b border-line last:border-0"
              >
                <span className="block text-sm text-fg">{s.ism}</span>
                <span className="flex justify-between gap-2 text-2xs text-muted">
                  <span>{s.tavsif ?? ""}</span>
                  <span className={s.qarz > 0 ? "text-debt" : "text-faint"}>
                    Qarz: {formatSomLabel(s.qarz)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
