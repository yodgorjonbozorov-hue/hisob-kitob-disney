"use client";

import { formatMoney } from "@/lib/format";
import { kechikkanKun, USTUN_NOMI, zakazlarniTartibla, type Ustun } from "@/lib/crm/pipeline";
import { BuyurtmaKarta } from "./BuyurtmaKarta";
import type { BuyurtmaDTO } from "./turlar";

const USTUN_RANG: Record<Ustun, string> = {
  KUTILAYOTGAN: "border-line",
  BUGUNGI: "border-brand/50",
  JARAYONDA: "border-debt-fg/40",
  YUTILDI: "border-income/50",
  YOQOTILDI: "border-expense/40",
};

/**
 * DOSKA USTUNI (8-talab): sarlavhada nomi, zakaz soni va umumiy summa —
 * joriy filtr bo'yicha.
 *
 * SAHIFALASH: ustunda bir vaqtda 10 tadan zakaz ko'rinadi, qolgani
 * "Yana ko'rsatish" bilan SERVERDAN keladi (`/api/crm/board`). Sarlavhadagi
 * raqamlar esa butun ustunniki — ular sahifadan emas, bazadagi jamdan
 * (`jami`/`summa`), aks holda "10 ta" degan yolg'on son ko'rinardi.
 *
 * TARTIB `lib/crm/pipeline.ts` da (sof funksiya, server bilan bir xil):
 * YUTILDI/JARAYONDA/YO'QOTILDI — eng oxirgi shu holatga o'tgan zakaz ENG
 * TEPADA; KUTILAYOTGAN/BUGUNGI — kechikkanlar tepada, keyin yaqin kun
 * (7-talab: eski bajarilmagan zakaz ko'zdan yo'qolmasin).
 */
export function ZakazUstuni({
  ustun,
  zakazlar,
  bugun,
  soni,
  summa,
  yanaBormi,
  yuklanmoqda,
  onYana,
  onDrop,
  onTanlash,
  onDragStart,
  onDragEnd,
}: {
  ustun: Ustun;
  zakazlar: BuyurtmaDTO[];
  bugun: string;
  /** Ustundagi JAMI zakaz soni (sahifadan emas, bazadan). */
  soni: number;
  /** Ustundagi jami summa. */
  summa: number;
  /** Serverda yana zakaz bormi ("Yana ko'rsatish" tugmasi). */
  yanaBormi: boolean;
  yuklanmoqda: boolean;
  onYana: () => void;
  onDrop: () => void;
  onTanlash: (b: BuyurtmaDTO) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const kechikkanlar = zakazlar.filter((b) => kechikkanKun(b.holat, b.sana, bugun) > 0).length;

  const tartiblangan = zakazlarniTartibla(zakazlar, ustun, bugun);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`shrink-0 w-[78vw] max-w-[18rem] sm:w-72 sm:max-w-none bg-surface-2/60 rounded-2xl border ${USTUN_RANG[ustun]} p-2.5`}
    >
      <div className="px-1.5 pb-2 space-y-0.5">
        <p className="text-sm font-semibold text-fg">{USTUN_NOMI[ustun]}</p>
        <p className="text-2xs text-faint tnum">
          {soni} ta{summa > 0 ? ` • ${formatMoney(summa)}` : ""}
        </p>
        {kechikkanlar > 0 && (
          <p className="text-2xs text-expense font-medium">🔴 {kechikkanlar} ta kechikkan</p>
        )}
      </div>
      <div className="space-y-2 min-h-[60px]">
        {tartiblangan.length === 0 ? (
          <p className="text-2xs text-faint px-1.5 py-3">Zakaz yo&apos;q.</p>
        ) : (
          tartiblangan.map((b) => (
            <BuyurtmaKarta
              key={b.id}
              b={b}
              ustun={ustun}
              bugun={bugun}
              onClick={() => onTanlash(b)}
              onDragStart={() => onDragStart(b.id)}
              onDragEnd={onDragEnd}
            />
          ))
        )}
        {yanaBormi && (
          <button
            onClick={onYana}
            disabled={yuklanmoqda}
            className="w-full rounded-lg border border-line bg-surface text-xs font-medium py-2 text-brand disabled:opacity-50"
          >
            {yuklanmoqda ? "Yuklanmoqda..." : "Yana ko'rsatish"}
          </button>
        )}
      </div>
    </div>
  );
}
