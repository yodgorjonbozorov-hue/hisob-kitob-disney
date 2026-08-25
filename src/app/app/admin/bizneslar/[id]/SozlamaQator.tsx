"use client";

import { cn } from "@/lib/cn";

/**
 * Sozlama qatori: nomi + izoh + o'ng tomonda tugma yoki holat.
 * Modullar, kassa va ombor bo'limlari shu bitta shakldan quriladi.
 */
export function SozlamaQator({
  nomi,
  tavsif,
  belgi,
  ogohlantirish,
  ong,
}: {
  nomi: string;
  tavsif: string;
  /** Nom yonidagi kichik yorliq ("doim yoqiq", "yuqori tarifda"). */
  belgi?: { matn: string; tur?: "oddiy" | "brand" };
  ogohlantirish?: string;
  ong: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-line last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-fg text-sm">{nomi}</p>
          {belgi && (
            <span
              className={cn(
                "text-2xs px-2 py-0.5 rounded-full",
                belgi.tur === "brand" ? "bg-brand-wash text-brand" : "bg-surface-2 text-muted"
              )}
            >
              {belgi.matn}
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-1">{tavsif}</p>
        {ogohlantirish && (
          <p className="text-xs text-debt-fg bg-debt-soft rounded-lg px-3 py-2 mt-2">
            {ogohlantirish}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center min-h-[44px]">{ong}</div>
    </div>
  );
}

/** Yoqish/o'chirish tugmasi (Sozlamalar → Modullar dagi bilan bir xil ko'rinish). */
export function Almashtirgich({
  yoqilgan,
  disabled,
  label,
  onClick,
}: {
  yoqilgan: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={yoqilgan}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative shrink-0 w-11 h-6 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed",
        yoqilgan ? "bg-income" : "bg-line"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
          yoqilgan ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  );
}
