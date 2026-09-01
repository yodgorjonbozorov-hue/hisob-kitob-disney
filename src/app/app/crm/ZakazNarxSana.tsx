"use client";

/**
 * Zakaz NARXI va SANASI qatori. Alohida komponent — "Yangi zakaz" oynasi
 * 250 satrlik chegarada qolishi kerak (CLAUDE.md). Mantiq yo'q.
 *
 * ZAKAZ SANASI majburiy: doskadagi ustun aynan shundan hisoblanadi.
 */
const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

export function ZakazNarxSana({
  summa,
  onSumma,
  sana,
  onSana,
  bugun,
}: {
  summa: string;
  onSumma: (v: string) => void;
  sana: string;
  onSana: (v: string) => void;
  bugun: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label className="block space-y-1">
        <span className="text-xs text-muted">Narx (so&apos;m)</span>
        <input
          value={summa}
          onChange={(e) => onSumma(e.target.value)}
          placeholder="500000"
          inputMode="numeric"
          className={INPUT}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted">
          Zakaz sanasi <span className="text-expense">*</span>
        </span>
        <input
          type="date"
          value={sana}
          onChange={(e) => onSana(e.target.value)}
          className={INPUT}
          required
        />
        <span className="block text-2xs text-faint">
          {sana === bugun ? "Bugungi zakazlarga tushadi" : "Kutilayotgan zakazlarga tushadi"}
        </span>
      </label>
    </div>
  );
}
