"use client";

/**
 * NAQD / QARZGA — segmentli tanlov (modern segmented control).
 * Rang faqat ma'no uchun: yashil nuqta = pul kirdi, jigarrang = qarz
 * (DESIGN.md qoidasi — rang bezak emas).
 */
export function TolovTuriTanlov({
  value,
  onChange,
  disabled,
}: {
  value: "naqd" | "qarz";
  onChange: (v: "naqd" | "qarz") => void;
  disabled?: boolean;
}) {
  const variantlar = [
    { value: "naqd" as const, label: "Naqd", nuqta: "bg-income" },
    { value: "qarz" as const, label: "Qarzga", nuqta: "bg-debt" },
  ];
  return (
    <div className="grid grid-cols-2 p-1 rounded-lg bg-surface-2 gap-1" role="radiogroup" aria-label="To'lov turi">
      {variantlar.map((v) => {
        const faol = v.value === value;
        return (
          <button
            key={v.value}
            type="button"
            role="radio"
            aria-checked={faol}
            disabled={disabled}
            onClick={() => onChange(v.value)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition min-h-[44px] ${
              faol ? "bg-surface text-fg shadow-sm border border-line" : "text-muted hover:text-fg"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${v.nuqta} ${faol ? "" : "opacity-40"}`} aria-hidden="true" />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
