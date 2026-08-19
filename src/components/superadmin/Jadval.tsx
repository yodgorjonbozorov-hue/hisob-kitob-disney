import { cn } from "@/lib/cn";

/**
 * MA'LUMOT JADVALI (talab 34/40).
 *
 * RESPONSIV STRATEGIYA:
 *  · ≥1024px — haqiqiy jadval (data-dense, ustunlar tekislangan);
 *  · <1024px — har qator KARTOChKA bo'ladi (ustun nomi + qiymat).
 * Bitta jadval ikki marta yozilmasin degan qoida bilan: ustun ta'rifi
 * BITTA, ikkala ko'rinish shundan quriladi.
 *
 * Gorizontal siljish faqat jadval konteynerida — sahifaning O'ZI hech
 * qachon gorizontal siljimaydi.
 */

export interface Ustun<T> {
  kalit: string;
  sarlavha: string;
  /** Qator uchun katak mazmuni. */
  katak: (qator: T) => React.ReactNode;
  /** Raqamli ustun — o'ngga tekislanadi va tabular bo'ladi. */
  raqam?: boolean;
  /** Mobil kartochkada yashiriladigan ikkinchi darajali ustun. */
  ikkinchiDarajali?: boolean;
  className?: string;
}

export function Jadval<T>({
  ustunlar,
  qatorlar,
  kalit,
  bosh,
  qatorHref,
}: {
  ustunlar: Ustun<T>[];
  qatorlar: T[];
  kalit: (qator: T) => string;
  /** Ro'yxat bo'sh bo'lgandagi ko'rinish. */
  bosh?: React.ReactNode;
  /** Qator bosilganda ochiladigan havola (bo'lsa qator bosiladigan bo'ladi). */
  qatorHref?: (qator: T) => string;
}) {
  if (qatorlar.length === 0) return <>{bosh}</>;

  return (
    <>
      {/* Desktop: jadval */}
      <div className="hidden lg:block jadval-siljish rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {ustunlar.map((u) => (
                <th
                  key={u.kalit}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 text-2xs uppercase tracking-wide font-medium text-faint whitespace-nowrap",
                    u.raqam ? "text-right" : "text-left"
                  )}
                >
                  {u.sarlavha}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {qatorlar.map((q) => (
              <tr
                key={kalit(q)}
                className="border-b border-line last:border-0 hover:bg-surface-2/50 transition"
              >
                {ustunlar.map((u) => (
                  <td
                    key={u.kalit}
                    className={cn(
                      "px-3 py-2.5 align-middle",
                      u.raqam && "text-right tabular-nums",
                      u.className
                    )}
                  >
                    {qatorHref && u.kalit === ustunlar[0].kalit ? (
                      <a href={qatorHref(q)} className="text-brand hover:underline font-medium">
                        {u.katak(q)}
                      </a>
                    ) : (
                      u.katak(q)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil/planshet: kartochkalar */}
      <div className="lg:hidden space-y-2">
        {qatorlar.map((q) => (
          <div key={kalit(q)} className="rounded-xl border border-line bg-surface p-3">
            <div className="font-medium text-fg mb-2">
              {qatorHref ? (
                <a href={qatorHref(q)} className="text-brand">
                  {ustunlar[0].katak(q)}
                </a>
              ) : (
                ustunlar[0].katak(q)
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {ustunlar.slice(1).map((u) => (
                <div key={u.kalit} className={cn(u.ikkinchiDarajali && "hidden sm:block")}>
                  <dt className="text-2xs text-faint">{u.sarlavha}</dt>
                  <dd className={cn("text-sm text-fg", u.raqam && "tabular-nums")}>{u.katak(q)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
