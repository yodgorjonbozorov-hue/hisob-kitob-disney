"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { CategoryBars } from "@/components/charts/CategoryBars";
import {
  KategoriyaTafsilot,
  type KategoriyaTanlov,
} from "@/components/kategoriya/KategoriyaTafsilot";
import type { CategoryBreakdownItem } from "@/lib/queries/dashboard";

/** Dashboardda sukut bo'yicha nechta kategoriya ko'rsatiladi. */
const TOP = 5;

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
 *
 * SUKUT BO'YICHA — TOP 5. Kategoriyasi ko'p bizneste ro'yxat ekranni
 * to'ldirib, dashboardning qolgan bloklarini pastga surib yuborardi.
 * Ma'lumot YASHIRILMAYDI: "Barchasini ko'rish" bosilganda o'sha ro'yxat
 * to'liq ochiladi (qo'shimcha so'rovsiz — hammasi allaqachon shu yerda).
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

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <KategoriyaKartasi
          sarlavha="Kirim — kategoriya bo'yicha"
          royxat={kirim}
          turi="kirim"
          emptyLabel="Bu oyda kirim yo'q"
          onSelect={setTanlov}
        />
        <KategoriyaKartasi
          sarlavha="Chiqim — kategoriya bo'yicha"
          royxat={chiqim}
          turi="chiqim"
          emptyLabel="Bu oyda chiqim yo'q"
          onSelect={setTanlov}
        />
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

function KategoriyaKartasi({
  sarlavha,
  royxat,
  turi,
  emptyLabel,
  onSelect,
}: {
  sarlavha: string;
  royxat: CategoryBreakdownItem[];
  turi: "kirim" | "chiqim";
  emptyLabel: string;
  onSelect: (t: KategoriyaTanlov) => void;
}) {
  const [hammasi, setHammasi] = useState(false);
  const korinadi = hammasi ? royxat : royxat.slice(0, TOP);
  const qolgan = royxat.length - korinadi.length;

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h2 className="font-medium text-fg">{sarlavha}</h2>
        {royxat.length > TOP && (
          <span className="text-2xs text-faint tnum shrink-0">
            {hammasi ? `${royxat.length} ta` : `TOP ${TOP} / ${royxat.length}`}
          </span>
        )}
      </div>
      <CategoryBars
        data={korinadi.map((c) => ({
          categoryId: c.categoryId,
          nomi: c.nomi,
          summa: c.summa,
          foiz: c.foiz,
        }))}
        emptyLabel={emptyLabel}
        onSelect={(d) => d.categoryId && onSelect({ categoryId: d.categoryId, nomi: d.nomi, turi })}
      />
      {royxat.length > TOP && (
        <button
          type="button"
          onClick={() => setHammasi((v) => !v)}
          aria-expanded={hammasi}
          className="mt-3 text-sm text-brand font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        >
          {hammasi ? "Kamroq ko'rsatish" : `Barchasini ko'rish (yana ${qolgan} ta) →`}
        </button>
      )}
    </Card>
  );
}
