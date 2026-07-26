import { Money } from "@/components/ui/Money";
import { categoryVisual } from "@/lib/categoryVisual";

export interface BarDatum {
  nomi: string;
  summa: number;
  foiz: number;
}

/**
 * Kategoriya taqsimoti — pie/donut EMAS (REDESIGN.md 7). Gorizontal bar ro'yxati:
 * nom, summa, foiz, rangli bar. Rang kategoriya nomidan doimiy biriktiriladi.
 */
export function CategoryBars({ data, emptyLabel }: { data: BarDatum[]; emptyLabel: string }) {
  if (data.length === 0) {
    return <p className="text-faint text-sm text-center py-10">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((d) => d.foiz), 1);

  return (
    <ul className="space-y-3">
      {data.map((d, i) => {
        const { Icon, color } = categoryVisual(d.nomi);
        return (
          <li key={d.nomi}>
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
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(d.foiz / max) * 100}%`, backgroundColor: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
