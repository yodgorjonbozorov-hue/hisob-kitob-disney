"use client";

import { cn } from "@/lib/cn";
import { categoryVisual } from "@/lib/categoryVisual";

interface Cat {
  id: string;
  nomi: string;
}

/**
 * Kategoriya tanlash — dropdown emas, ikonkali katakchalar to'ri (REDESIGN.md 5.1).
 * Har katak ≥72px. `recentIds` — "Tez tanlov" (eng ko'p ishlatilgan) yuqorida.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  recentIds = [],
}: {
  categories: Cat[];
  value: string;
  onChange: (id: string) => void;
  recentIds?: string[];
}) {
  const recent = recentIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Cat => !!c)
    .slice(0, 4);

  return (
    <div className="space-y-3">
      {recent.length > 0 && (
        <div>
          <p className="text-2xs text-faint mb-1.5">Tez tanlov</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((c) => (
              <Tile key={c.id} cat={c} active={value === c.id} onClick={() => onChange(c.id)} compact />
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {categories.map((c) => (
          <Tile key={c.id} cat={c} active={value === c.id} onClick={() => onChange(c.id)} />
        ))}
      </div>
    </div>
  );
}

function Tile({ cat, active, onClick, compact = false }: { cat: Cat; active: boolean; onClick: () => void; compact?: boolean }) {
  const { Icon, color } = categoryVisual(cat.nomi);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border text-center transition active:scale-[0.98]",
        compact ? "px-3 py-2 min-h-[44px] flex-row gap-2" : "min-h-[72px] p-2",
        active ? "border-brand bg-brand-wash" : "border-line bg-surface hover:bg-surface-2"
      )}
    >
      <Icon className={cn("shrink-0", compact ? "w-4 h-4" : "w-6 h-6")} style={{ color }} />
      <span className={cn("text-fg leading-tight", compact ? "text-sm" : "text-xs")}>{cat.nomi}</span>
    </button>
  );
}
