"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { CategoryBars } from "@/components/charts/CategoryBars";
import {
  KategoriyaTafsilot,
  type KategoriyaTanlov,
} from "@/components/kategoriya/KategoriyaTafsilot";
import type { CategoryBreakdownItem } from "@/lib/queries/dashboard";

/**
 * BOSH SAHIFADAGI KATEGORIYA TAQSIMOTI — bosiladigan.
 *
 * Qator bosilganda AYNI kategoriya va AYNI yo'nalishdagi yozuvlar ochiladi:
 * "Kirim → Gul" da faqat kirimlar, "Chiqim → Gul" da faqat chiqimlar.
 * Yo'nalish tanlovga qotirilgan, oynada uni almashtirib bo'lmaydi — aks
 * holda foydalanuvchi qaysi raqamni ko'rayotganini yo'qotardi.
 *
 * Oyni server beradi va tafsilot ham SHU oy bilan ochiladi — shuning uchun
 * oynadagi jami kartadagi summa bilan bir xil bo'ladi.
 */
export function KategoriyaBloki({
  kirim,
  chiqim,
  oyFrom,
  oyTo,
  oyNomi,
}: {
  kirim: CategoryBreakdownItem[];
  chiqim: CategoryBreakdownItem[];
  /** Tanlangan oy oralig'i, "YYYY-MM-DD" (ikkala chet ham kiradi). */
  oyFrom: string;
  oyTo: string;
  oyNomi: string;
}) {
  const [tanlov, setTanlov] = useState<KategoriyaTanlov | null>(null);

  const qatorlar = (royxat: CategoryBreakdownItem[]) =>
    royxat.map((c) => ({
      categoryId: c.categoryId,
      nomi: c.nomi,
      summa: c.summa,
      foiz: c.foiz,
    }));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-medium text-fg mb-4">Kirim — kategoriya bo&apos;yicha</h2>
          <CategoryBars
            data={qatorlar(kirim)}
            emptyLabel="Bu oyda kirim yo'q"
            onSelect={(d) =>
              d.categoryId &&
              setTanlov({ categoryId: d.categoryId, nomi: d.nomi, turi: "kirim" })
            }
          />
        </Card>
        <Card>
          <h2 className="font-medium text-fg mb-4">Chiqim — kategoriya bo&apos;yicha</h2>
          <CategoryBars
            data={qatorlar(chiqim)}
            emptyLabel="Bu oyda chiqim yo'q"
            onSelect={(d) =>
              d.categoryId &&
              setTanlov({ categoryId: d.categoryId, nomi: d.nomi, turi: "chiqim" })
            }
          />
        </Card>
      </div>

      {tanlov && (
        <KategoriyaTafsilot
          tanlov={tanlov}
          oy={{ from: oyFrom, to: oyTo }}
          oyNomi={oyNomi}
          onClose={() => setTanlov(null)}
        />
      )}
    </>
  );
}
