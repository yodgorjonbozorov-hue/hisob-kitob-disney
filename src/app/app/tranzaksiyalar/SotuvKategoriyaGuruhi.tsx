"use client";

import { ChevronDown } from "lucide-react";
import { formatMoney, formatSom } from "@/lib/format";
import type { SotuvBirlikDTO, SotuvKategoriyaDTO } from "@/lib/queries/sotuvStatistika";

/** "25 dona", ko'p birlik bo'lsa "25 dona · 4 kg". */
export function birliklarMatni(birliklar: SotuvBirlikDTO[]): string {
  if (birliklar.length === 0) return "0";
  return birliklar.map((b) => `${formatSom(b.miqdor)} ${b.birlik}`).join(" · ");
}

/**
 * BITTA KATEGORIYA GURUHI — sarlavha va ichidagi mahsulotlar.
 *
 * Har mahsulot BITTA qator: kun davomida 5 marta sotilgan Coca-Cola 5 ta
 * qator emas, bitta "25 dona sotildi" qatori bo'ladi (jamlash serverda —
 * lib/queries/sotuvStatistika.ts). Necha marta sotilgani ma'lumot uchun
 * kichik matnda qoladi.
 */
export function SotuvKategoriyaGuruhi({
  guruh,
  ochiq,
  onToggle,
}: {
  guruh: SotuvKategoriyaDTO;
  ochiq: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-line overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={ochiq}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface-2 text-left min-h-[44px] hover:bg-surface-2/70 transition"
      >
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-muted transition-transform ${ochiq ? "" : "-rotate-90"}`}
        />
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-fg truncate">{guruh.nomi}</span>
          <span className="block text-2xs text-muted tnum">
            {guruh.mahsulotlar.length} ta mahsulot · {birliklarMatni(guruh.birliklar)}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-income tnum">
          {formatMoney(guruh.summa)}
        </span>
      </button>

      {ochiq && (
        <ul className="divide-y divide-line">
          {guruh.mahsulotlar.map((m) => (
            <li
              key={m.productId}
              className="flex items-center gap-3 px-3 py-2.5 bg-surface"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg truncate">{m.nomi}</p>
                <p className="text-2xs text-muted tnum">
                  {formatSom(m.miqdor)} {m.birlik} sotildi
                  {m.sotuvSoni > 1 && ` · ${m.sotuvSoni} marta`}
                </p>
              </div>
              <p className="shrink-0 text-sm text-fg tnum">{formatMoney(m.summa)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
