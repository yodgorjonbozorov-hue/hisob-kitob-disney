"use client";

import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { foizgaAylantir, foizMatni, songa, type IntervalForm } from "./sozlamaShakl";

/** PROGRESSIV BONUS INTERVALLARI — har interval o'z foizi bilan. */
export function IntervalTahrir({
  intervallar,
  onChange,
}: {
  intervallar: IntervalForm[];
  onChange: (v: IntervalForm[]) => void;
}) {
  const ozgart = (idx: number, patch: Partial<IntervalForm>) =>
    onChange(intervallar.map((x, j) => (j === idx ? { ...x, ...patch } : x)));

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Progressiv sotuv bonusi</h2>
      <p className="text-2xs text-muted mt-1">
        Har interval O&apos;Z foizi bilan hisoblanadi — umumiy summaga bitta foiz
        qo&apos;llanmaydi. Yuqori chegara bo&apos;sh qoldirilsa &quot;va undan yuqori&quot;.
      </p>

      <div className="mt-3 grid grid-cols-[1fr_1fr_5rem_1.5rem] gap-2 text-2xs text-faint">
        <span>Dan (so&apos;m)</span>
        <span>Gacha (so&apos;m)</span>
        <span>Foiz</span>
        <span />
      </div>

      <div className="mt-1 space-y-2">
        {intervallar.map((i, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_5rem_1.5rem] gap-2 items-center">
            <input
              aria-label="Interval boshi (so'm)"
              value={i.dan.toLocaleString("uz-UZ")}
              onChange={(e) => ozgart(idx, { dan: songa(e.target.value) })}
              className={INPUT_CLASS}
              inputMode="numeric"
            />
            <input
              aria-label="Interval oxiri (so'm)"
              value={i.gacha === null ? "" : i.gacha.toLocaleString("uz-UZ")}
              placeholder="cheksiz"
              onChange={(e) =>
                ozgart(idx, { gacha: e.target.value.trim() ? songa(e.target.value) : null })
              }
              className={INPUT_CLASS}
              inputMode="numeric"
            />
            <input
              aria-label="Bonus foizi"
              value={foizMatni(i.foiz)}
              onChange={(e) => ozgart(idx, { foiz: foizgaAylantir(e.target.value) })}
              className={INPUT_CLASS}
              inputMode="decimal"
            />
            <button
              type="button"
              onClick={() => onChange(intervallar.filter((_, j) => j !== idx))}
              className="text-2xs text-expense hover:underline"
              aria-label="Intervalni o'chirish"
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
        onClick={() =>
          onChange([
            ...intervallar,
            {
              dan: intervallar.length ? intervallar[intervallar.length - 1].gacha ?? 0 : 0,
              gacha: null,
              foiz: 500,
            },
          ])
        }
      >
        Interval qo&apos;shish
      </Button>
    </section>
  );
}
