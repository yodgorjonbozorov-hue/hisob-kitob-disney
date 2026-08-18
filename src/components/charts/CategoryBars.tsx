import { Money } from "@/components/ui/Money";
import { categoryVisual } from "@/lib/categoryVisual";

export interface BarDatum {
  /** Bosiladigan rejimda majburiy — tafsilot shu ID bo'yicha ochiladi. */
  categoryId?: string;
  nomi: string;
  summa: number;
  foiz: number;
}

/**
 * Kategoriya taqsimoti — pie/donut EMAS (REDESIGN.md 7). Gorizontal bar ro'yxati:
 * nom, summa, foiz, rangli bar. Rang kategoriya nomidan doimiy biriktiriladi.
 *
 * `onSelect` berilsa har qator BOSILADIGAN bo'ladi (o'ng chetda "›" belgisi
 * bilan) va kategoriya tafsilotini ochadi. Berilmasa — avvalgidek oddiy
 * ro'yxat; shu bois server komponentlarida ham ishlatilaveradi.
 */
export function CategoryBars({
  data,
  emptyLabel,
  onSelect,
}: {
  data: BarDatum[];
  emptyLabel: string;
  onSelect?: (d: BarDatum) => void;
}) {
  if (data.length === 0) {
    return <p className="text-faint text-sm text-center py-10">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((d) => d.foiz), 1);

  return (
    <ul className="space-y-1">
      {data.map((d, i) => {
        const { Icon, color } = categoryVisual(d.nomi);
        const bosiladi = Boolean(onSelect && d.categoryId);

        const ichi = (
          <>
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="flex items-center gap-2 min-w-0">
                <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                <span className="text-fg text-sm truncate">
                  <span className="text-faint tnum mr-1">{i + 1}.</span>
                  {d.nomi}
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <Money value={d.summa} size="sm" suffix={false} />
                <span className="text-faint text-2xs tnum w-9 text-right">{d.foiz.toFixed(0)}%</span>
                {bosiladi && (
                  <span aria-hidden className="text-faint text-sm leading-none">
                    ›
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(d.foiz / max) * 100}%`, backgroundColor: color }}
              />
            </div>
          </>
        );

        return (
          <li key={d.categoryId ?? d.nomi}>
            {bosiladi ? (
              <button
                type="button"
                onClick={() => onSelect?.(d)}
                aria-label={`${d.nomi} — yozuvlarni ko'rish`}
                className="w-full text-left rounded-lg -mx-2 px-2 py-2 transition hover:bg-surface-2 active:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {ichi}
              </button>
            ) : (
              <div className="py-2">{ichi}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
