"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { CategoryBars } from "@/components/charts/CategoryBars";
import {
  KategoriyaTafsilot,
  type KategoriyaTanlov,
} from "@/components/kategoriya/KategoriyaTafsilot";
import { formatMoneyCompact } from "@/lib/format";
import type { CategoryBreakdownItem } from "@/lib/queries/dashboard";

/** Standart holatda nechta kategoriya ko'rinadi. */
const TOP = 5;

/**
 * BOSH SAHIFADAGI KATEGORIYA TAQSIMOTI — bosiladigan.
 *
 * DEFAULT — TOP 5 (eng katta summadan kichikka). Ilgari barcha
 * kategoriyalar chiqardi va 30 ta kategoriyali bizneste bu blok butun
 * ekranni egallab, pastdagi grafiklarni ko'rinmas qilib qo'yardi.
 * Qolganlari "Barchasini ko'rish" bilan ochiladi — ma'lumot YO'QOLMAYDI,
 * u faqat bir bosish narida.
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

/** Bitta yo'nalish kartasi: TOP 5 + yig'ish/yoyish tugmasi. */
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
  const korinadigan = hammasi ? royxat : royxat.slice(0, TOP);
  const qolgan = royxat.length - korinadigan.length;
  // "Yana 12 ta" ortidagi summa ham ko'rsatiladi: yashiringan qism qancha
  // ekanini bilmasdan "Barchasini ko'rish" ni bosish kerak bo'lardi.
  const qolganSumma = royxat.slice(TOP).reduce((a, c) => a + c.summa, 0);

  return (
    <Card>
      <h2 className="font-medium text-fg mb-4">{sarlavha}</h2>
      <CategoryBars
        data={korinadigan.map((c) => ({
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
          onClick={() => setHammasi((h) => !h)}
          aria-expanded={hammasi}
          className="mt-3 w-full rounded-lg py-2 text-sm font-medium text-brand transition hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {hammasi ? (
            "Yig'ish"
          ) : (
            <>
              Barchasini ko&apos;rish
              <span className="text-faint font-normal">
                {" "}
                — yana {qolgan} ta · {formatMoneyCompact(qolganSumma)}
              </span>
            </>
          )}
        </button>
      )}
    </Card>
  );
}
