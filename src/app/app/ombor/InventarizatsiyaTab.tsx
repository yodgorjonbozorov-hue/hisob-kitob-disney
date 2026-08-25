"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatSom, formatDateUz } from "@/lib/format";
import type { StockAdjustmentDTO } from "@/lib/queries/inventory";

const TURI_NOMI: Record<string, string> = {
  inventarizatsiya: "Qoldiqni to'g'rilash",
  chiqarish: "Hisobdan chiqarish",
  taminot_bekor: "Ta'minot bekor qilindi",
};

/**
 * INVENTARIZATSIYA TABI — sanash va hisobdan chiqarish tarixi.
 *
 * Bu ro'yxat "kamomad qayerdan chiqdi?" degan savolga javob beradi: har
 * qatorda kim emas, NIMA va NEGA o'zgargani yozilgan. Yozuvlar hech qachon
 * o'chirilmaydi va tahrirlanmaydi — noto'g'ri sanash ham TARIXNING bir
 * qismi, uning ustiga yangi to'g'rilash yoziladi.
 */
export function InventarizatsiyaTab({
  togrilashlar,
  onInventarizatsiya,
  onChiqarish,
}: {
  togrilashlar: StockAdjustmentDTO[];
  onInventarizatsiya: () => void;
  onChiqarish: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button onClick={onInventarizatsiya} className="w-full">
          📋 Inventarizatsiya
        </Button>
        <Button variant="secondary" onClick={onChiqarish} className="w-full">
          ➖ Hisobdan chiqarish
        </Button>
      </div>

      <p className="text-xs text-muted bg-surface-2 rounded-lg px-3 py-2">
        Inventarizatsiya — real qoldiqni sanab kiritish. Hisobdan chiqarish —
        buzilgan yoki yo&apos;qolgan tovar; bu sotuv hisoblanmaydi va kassaga
        pul tushmaydi.
      </p>

      {togrilashlar.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Hali to'g'rilash yo'q"
          description="Qoldiq faqat ta'minot va sotuv orqali o'zgargan."
        />
      ) : (
        <ul className="rounded-2xl border border-line divide-y divide-line bg-surface">
          {togrilashlar.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">{t.productNomi}</p>
                <p className="text-2xs text-muted">
                  {formatDateUz(new Date(t.sana))} · {TURI_NOMI[t.turi] ?? t.turi} · {t.sabab}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-semibold tnum ${
                    t.farq < 0 ? "text-expense" : "text-income"
                  }`}
                >
                  {t.farq > 0 ? "+" : ""}
                  {formatSom(t.farq)}
                </p>
                <p className="text-2xs text-muted tnum">
                  {formatSom(t.eskiMiqdor)} → {formatSom(t.yangiMiqdor)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
