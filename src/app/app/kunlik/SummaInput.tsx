"use client";

import { Money } from "@/components/ui/Money";
import { farqKorinishi } from "./holat";

/**
 * PUL KIRITISH MAYDONI — solishtiruv oynalari uchun yagona element.
 *
 * `inputMode="numeric"` va `pattern="[0-9 ]*"` — telefonda RAQAMLI klaviatura
 * ochiladi (harfli emas). `type="text"` ataylab: `type="number"` da brauzer
 * o'z strelkalarini qo'shadi, bo'sh joyli "1 500 000" ni rad etadi va
 * g'ildirak bilan qiymatni beixtiyor o'zgartirib yuboradi.
 */
export function SummaInput({
  id,
  label,
  value,
  onChange,
  yordam,
  autoFocus = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  yordam?: string;
  autoFocus?: boolean;
}) {
  const son = sonOqi(value);
  return (
    <div>
      <label className="block text-sm text-muted mb-1" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoFocus={autoFocus}
        inputMode="numeric"
        pattern="[0-9 ]*"
        autoComplete="off"
        placeholder="0"
        className="w-full min-h-[48px] px-3 py-2.5 rounded-xl bg-surface-2 border border-line text-fg tnum text-lg focus:border-brand focus:outline-none"
      />
      {son !== null && son > 0 && (
        <p className="text-2xs text-faint mt-1">
          Kiritilgan: <Money value={son} size="sm" tone="neutral" />
        </p>
      )}
      {yordam && <p className="text-2xs text-faint mt-1">{yordam}</p>}
    </div>
  );
}

/** "1 500 000" / "1,500,000" -> 1500000. Xato bo'lsa null. */
export function sonOqi(raw: string): number | null {
  const tozalangan = raw.replace(/[\s, ]/g, "");
  if (tozalangan === "") return null;
  const son = Number(tozalangan);
  if (!Number.isInteger(son) || son < 0) return null;
  return son;
}

/**
 * TIZIM ↔ REAL ↔ FARQ bloki.
 *
 * Tizim hisobi ATAYLAB ko'rsatiladi (mahsulot egasining qarori): kassir
 * qancha chiqishi kerakligini bilib turib sanaydi va nomuvofiqlikni O'ZI
 * darhol ko'radi. Buning evaziga "ko'r-ko'rona sanash" nazorati yo'qoladi;
 * nazorat esa farq raqami, izoh majburiyati va audit izida qoladi.
 */
export function FarqBloki({
  kutilgan,
  real,
}: {
  kutilgan: number | null;
  real: number | null;
}) {
  const farq = kutilgan === null || real === null ? null : real - kutilgan;
  const kor = farqKorinishi(farq);

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3 space-y-1 text-sm tnum">
      <div className="flex justify-between gap-3">
        <span className="text-muted">Tizim bo&apos;yicha</span>
        {kutilgan === null ? (
          <span className="text-faint">—</span>
        ) : (
          <Money value={kutilgan} size="sm" tone="neutral" />
        )}
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted">Real (siz kiritdingiz)</span>
        {real === null ? (
          <span className="text-faint">—</span>
        ) : (
          <Money value={real} size="sm" tone="neutral" />
        )}
      </div>
      <div className="flex justify-between gap-3 pt-1 border-t border-line">
        <span className="font-medium text-fg">Farq</span>
        <span className={kor ? kor.klass : "text-faint"}>{kor ? kor.matn : "—"}</span>
      </div>
    </div>
  );
}
