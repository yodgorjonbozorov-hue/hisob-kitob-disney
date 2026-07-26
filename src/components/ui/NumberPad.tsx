"use client";

import { cn } from "@/lib/cn";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"] as const;
const QUICK = [10_000, 50_000, 100_000, 500_000];

/**
 * Kassir uchun katta raqam klaviaturasi (REDESIGN.md 5.1). Telefon klaviaturasi
 * emas — o'zimiz yasagan keypad, tugma balandligi ≥56px. `value` — so'mdagi son.
 */
export function NumberPad({
  value,
  onChange,
  tone = "income",
}: {
  value: number;
  onChange: (v: number) => void;
  tone?: "income" | "expense";
}) {
  function press(k: string) {
    if (k === "back") return onChange(Math.floor(value / 10));
    if (k === "000") return onChange(value * 1000);
    onChange(value * 10 + parseInt(k, 10));
  }
  const accent = tone === "income" ? "text-income" : "text-expense";

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(value + q)}
            className={cn(
              "px-3 h-10 rounded-lg bg-surface-2 text-fg text-sm font-medium tnum active:scale-95 transition",
              accent
            )}
          >
            +{q.toLocaleString("ru-RU").replace(/,/g, " ")}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="h-14 rounded-xl bg-surface border border-line text-fg text-xl font-display font-semibold active:bg-surface-2 active:scale-[0.98] transition flex items-center justify-center select-none"
            aria-label={k === "back" ? "O'chirish" : k}
          >
            {k === "back" ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM18 9l-6 6M12 9l6 6" />
              </svg>
            ) : (
              k
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
