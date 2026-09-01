"use client";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BallTarixDTO } from "@/lib/kpi/ball";

/**
 * BALL TARIXI — o'zgarmas audit jurnali.
 *
 * Yozuv TAHRIRLANMAYDI/O'CHIRILMAYDI: qaytarilgan yozuv ham ro'yxatda
 * qoladi va "qaytarilgan" deb belgilanadi, qaytarish esa alohida qator
 * bo'lib turadi. Shu bois "kim, qachon, nega" savoli har doim javobli.
 */
export function BallTarixi({
  tarix,
  qaytarishMumkin,
  onQaytar,
  kutilmoqda,
}: {
  tarix: BallTarixDTO[];
  qaytarishMumkin: boolean;
  onQaytar: (id: string) => void;
  kutilmoqda: string | null;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg mb-3">Ball tarixi</h2>

      {tarix.length === 0 ? (
        <EmptyState
          title="Bu oy ball o'zgarishi bo'lmagan"
          description="Barcha vazifalar to'liq ball bilan turibdi."
        />
      ) : (
        <ul className="space-y-2">
          {tarix.map((t) => (
            <li
              key={t.id}
              className={`rounded-xl border border-line p-3 ${t.qaytarilgan ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-2xs text-faint tnum">
                    {t.sana} · {t.taskNomi}
                  </p>
                  <p className="text-sm text-fg mt-0.5">{t.sabab}</p>
                  {t.izoh && <p className="text-2xs text-muted mt-0.5">{t.izoh}</p>}
                  <p className="text-2xs text-faint mt-1 tnum">
                    {t.ballOldin} → {t.ballKeyin}
                    {t.userIsm && ` · Rahbar: ${t.userIsm}`}
                  </p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p
                    className={`text-lg font-bold tnum ${t.ball < 0 ? "text-expense" : "text-income"}`}
                  >
                    {t.ball > 0 ? `+${t.ball}` : t.ball}
                  </p>
                  {t.kritik && <Badge tone="chiqim">Ishonch</Badge>}
                  {t.turi === "qaytarish" && <Badge tone="info">Qaytarish</Badge>}
                  {t.qaytarilgan && <Badge tone="neutral">Qaytarilgan</Badge>}
                </div>
              </div>

              {qaytarishMumkin && t.turi === "jarima" && !t.qaytarilgan && (
                <button
                  type="button"
                  onClick={() => onQaytar(t.id)}
                  disabled={kutilmoqda === t.id}
                  className="mt-2 text-2xs text-brand hover:underline disabled:opacity-50"
                >
                  {kutilmoqda === t.id ? "Qaytarilmoqda..." : "Ballni qaytarish"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
