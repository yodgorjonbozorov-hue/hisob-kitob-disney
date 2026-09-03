"use client";

import { formatMoney } from "@/lib/format";
import { kechikkanKun, USTUN_NOMI, type Ustun } from "@/lib/crm/pipeline";
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
 * TARTIB: KECHIKKAN zakazlar eng tepada (7-talab: eski bajarilmagan zakaz
 * ko'zdan yo'qolmasin), qolgani OXIRGI O'ZGARISH bo'yicha — yangi yaratilgan
 * yoki holati hozirgina o'zgargan zakaz ustun boshida (Yutildiga hozirgina
 * o'tkazilgan zakaz oxiriga tushib ketmaydi). Mobil va desktop bir xil:
 * ustun komponenti bitta.
 */
export function ZakazUstuni({
  ustun,
  zakazlar,
  bugun,
  onDrop,
  onTanlash,
  onDragStart,
  onDragEnd,
}: {
  ustun: Ustun;
  zakazlar: BuyurtmaDTO[];
  bugun: string;
  onDrop: () => void;
  onTanlash: (b: BuyurtmaDTO) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const jami = zakazlar.reduce((a, b) => a + b.summa, 0);
  const kechikkanlar = zakazlar.filter((b) => kechikkanKun(b.holat, b.sana, bugun) > 0).length;

  // Kechikkanlar oldinda, keyin oxirgi o'zgarish bo'yicha (yangi tepada).
  const tartiblangan = [...zakazlar].sort((a, b) => {
    const ka = kechikkanKun(a.holat, a.sana, bugun);
    const kb = kechikkanKun(b.holat, b.sana, bugun);
    if (ka !== kb) return kb - ka;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`shrink-0 w-[78vw] max-w-[18rem] sm:w-72 sm:max-w-none bg-surface-2/60 rounded-2xl border ${USTUN_RANG[ustun]} p-2.5`}
    >
      <div className="px-1.5 pb-2 space-y-0.5">
        <p className="text-sm font-semibold text-fg">{USTUN_NOMI[ustun]}</p>
        <p className="text-2xs text-faint tnum">
          {zakazlar.length} ta{jami > 0 ? ` • ${formatMoney(jami)}` : ""}
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
      </div>
    </div>
  );
}
