"use client";

import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { foizgaAylantir, foizMatni, songa, type QoidaForm } from "./sozlamaShakl";

/** BALL → VAZIFA HAQI FOIZI jadvali (chegaralar inclusive). */
export function BallQoidaTahrir({
  qoidalar,
  onChange,
}: {
  qoidalar: QoidaForm[];
  onChange: (v: QoidaForm[]) => void;
}) {
  const ozgart = (idx: number, patch: Partial<QoidaForm>) =>
    onChange(qoidalar.map((x, j) => (j === idx ? { ...x, ...patch } : x)));

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Ball → vazifa haqi foizi</h2>
      <p className="text-2xs text-muted mt-1">
        Chegaralar ikki tomondan ham kiradi (min ≤ ball ≤ max). Ball FAQAT vazifa haqiga
        ta&apos;sir qiladi — sotuv bonusi va plan bonusiga tegmaydi.
      </p>

      <div className="mt-3 grid grid-cols-[1fr_1fr_1fr_1.5rem] gap-2 text-2xs text-faint">
        <span>Eng kam ball</span>
        <span>Eng ko&apos;p ball</span>
        <span>To&apos;lov foizi</span>
        <span />
      </div>

      <div className="mt-1 space-y-2">
        {qoidalar.map((q, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1.5rem] gap-2 items-center">
            <input
              aria-label="Eng kam ball"
              value={q.minBall}
              onChange={(e) => ozgart(idx, { minBall: songa(e.target.value) })}
              className={INPUT_CLASS}
              inputMode="numeric"
            />
            <input
              aria-label="Eng ko'p ball"
              value={q.maxBall}
              onChange={(e) => ozgart(idx, { maxBall: songa(e.target.value) })}
              className={INPUT_CLASS}
              inputMode="numeric"
            />
            <input
              aria-label="To'lov foizi"
              value={foizMatni(q.foiz)}
              onChange={(e) => ozgart(idx, { foiz: foizgaAylantir(e.target.value) })}
              className={INPUT_CLASS}
              inputMode="decimal"
            />
            <button
              type="button"
              onClick={() => onChange(qoidalar.filter((_, j) => j !== idx))}
              className="text-2xs text-expense hover:underline"
              aria-label="Qoidani o'chirish"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        variant="secondary"
        className="mt-2"
        onClick={() => onChange([...qoidalar, { minBall: 0, maxBall: 0, foiz: 0 }])}
      >
        Qoida qo&apos;shish
      </Button>
    </section>
  );
}
