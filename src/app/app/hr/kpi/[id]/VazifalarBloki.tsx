"use client";

import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { VazifaHisobi } from "@/lib/kpi/oylik";
import { BallChizigi, foizMatn } from "../kpiUi";

/**
 * VAZIFALAR — har biri O'Z balli va O'Z to'lov foizi bilan.
 *
 * O'rtacha ball ATAYLAB ko'rsatilmaydi bu yerda: to'lov har vazifa uchun
 * alohida hisoblanadi, shuning uchun qatorlar ham alohida turadi. O'rtacha
 * faqat sarlavhadagi umumiy ko'rsatkich sifatida ishlatiladi.
 */
export function VazifalarBloki({
  vazifalar,
  boshlangichBall,
  ballBerish,
  onBallAyir,
}: {
  vazifalar: VazifaHisobi[];
  boshlangichBall: number;
  /** Ball ayirish tugmasi ko'rinsinmi (huquq + oy ochiq). */
  ballBerish: boolean;
  onBallAyir: (taskId: string) => void;
}) {
  if (vazifalar.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg mb-2">Vazifalar</h2>
        <EmptyState
          title="Hozircha bu xodimga vazifa biriktirilmagan"
          description="Vazifalar sozlamalar bo'limida yaratiladi va shu yerdan xodimga biriktiriladi."
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg mb-3">Vazifalar va ball</h2>
      <ul className="space-y-3">
        {vazifalar.map((v) => (
          <li key={v.taskId} className="rounded-xl border border-line p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{v.nomi}</p>
                {v.izoh && <p className="text-2xs text-muted mt-0.5">{v.izoh}</p>}
              </div>
              {ballBerish && (
                <Button size="sm" variant="secondary" onClick={() => onBallAyir(v.taskId)}>
                  − Ball
                </Button>
              )}
            </div>

            <div className="mt-2">
              <BallChizigi ball={v.ball} boshlangich={boshlangichBall} compact />
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2 text-2xs">
              <span className="text-muted tnum">
                {v.oylikHaq.toLocaleString("uz-UZ")} × {foizMatn(v.foiz)}
                {v.yoqotilgan > 0 && (
                  <span className="text-expense"> · bu oy −{v.yoqotilgan} ball</span>
                )}
              </span>
              <Money value={v.hisoblangan} size="sm" tone={v.foiz >= 10_000 ? "income" : "neutral"} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
