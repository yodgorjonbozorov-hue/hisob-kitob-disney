"use client";

import { Badge } from "@/components/ui/Badge";
import { formatDateUZ, formatSom } from "@/lib/format";
import { formatKgLabel } from "@/lib/kg";
import { AmalMenu } from "./AmalMenu";
import { tolovYorligi } from "./turlar";
import type { TransactionDTO } from "@/lib/queries/transactions";

/**
 * DESKTOP JADVALI (lg va undan keng).
 *
 * Vizual ierarxiya: kategoriya — qatordagi eng qora matn (odam avval uni
 * qidiradi), summa — o'ngda, tabular raqamlar bilan tekislangan, izoh va
 * xodim — bosiq. Summa FAQAT rangga tayanmaydi: `+`/`−` belgisi va
 * "Kirim/Chiqim" nishoni ham bor — rang ko'rmaydigan foydalanuvchi uchun
 * ham, oq-qora chop etilganda ham farq qoladi.
 *
 * BUTUN QATOR BOSILADI (audit K-5): ilgari tafsilotni ochish uchun faqat
 * KATEGORIYA katakchasidagi matnni bosish kerak edi — sana, summa yoki
 * izohga bosilganda hech narsa bo'lmasdi. Endi qator o'zi tugma:
 * `Tab` bilan fokus, `Enter`/`Space` bilan ochiladi.
 *
 * Qator ichidagi ALOHIDA amallar (belgilash katakchasi, amallar menyusi)
 * qator bosilishini ishga tushirmaydi — ularda hodisa to'xtatiladi.
 */
export function TransactionTable({
  items,
  selected,
  onToggleSelect,
  onToggleAll,
  onBatafsil,
  onTahrirlash,
  onOchirish,
  ozgartirsaBoladi,
}: {
  items: TransactionDTO[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onBatafsil: (t: TransactionDTO) => void;
  onTahrirlash: (t: TransactionDTO) => void;
  onOchirish: (t: TransactionDTO) => void;
  ozgartirsaBoladi: (t: TransactionDTO) => boolean;
}) {
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <div className="hidden lg:block jadval-siljish">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-muted text-xs uppercase">
          <tr>
            <th className="px-4 py-3 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Hammasini tanlash"
              />
            </th>
            <th className="text-left px-4 py-3">Sana</th>
            <th className="text-left px-4 py-3">Turi</th>
            <th className="text-left px-4 py-3">To&apos;lov</th>
            <th className="text-left px-4 py-3">Kategoriya</th>
            <th className="text-right px-4 py-3">Summa</th>
            <th className="text-left px-4 py-3">Izoh</th>
            <th className="text-left px-4 py-3">Kim kiritdi</th>
            <th className="text-right px-4 py-3 w-16">Amallar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((t) => {
            const kirim = t.turi === "kirim";
            const mumkin = ozgartirsaBoladi(t);
            return (
              <tr
                key={t.id}
                tabIndex={0}
                role="button"
                aria-label={`${t.category.nomi} — tafsilotni ochish`}
                onClick={() => onBatafsil(t)}
                onKeyDown={(e) => {
                  // Space sahifani pastga suradi — to'xtatiladi.
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onBatafsil(t);
                  }
                }}
                className={`cursor-pointer hover:bg-surface-2 transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset
                  focus-visible:ring-brand ${selected.has(t.id) ? "bg-brand/5" : ""}`}
              >
                {/* Belgilash katakchasi qator bosilishini ishga tushirmaydi. */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => onToggleSelect(t.id)}
                    aria-label="Tanlash"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted tnum">
                  {formatDateUZ(new Date(t.sana))}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={kirim ? "kirim" : "chiqim"}>{kirim ? "Kirim" : "Chiqim"}</Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{tolovYorligi(t)}</td>
                <td className="px-4 py-3">
                  {/* Qatorning o'zi tugma — ichiga ikkinchi tugma qo'yilmaydi
                      (ichma-ich interaktiv elementlar skrinriderni chalkashtiradi). */}
                  <span className="font-medium text-fg">{t.category.nomi}</span>
                  {/* Kg savdosi: miqdor × 1 kg narxi — o'sha savdodagi REAL narx. */}
                  {t.miqdorGr != null && t.kgNarxi != null && (
                    <span className="block text-2xs text-muted tnum">
                      {formatKgLabel(t.miqdorGr)} × {formatSom(t.kgNarxi)} soʻm
                    </span>
                  )}
                </td>
                <td
                  className={`px-4 py-3 text-right font-display font-semibold tnum whitespace-nowrap ${
                    kirim ? "text-income" : "text-expense"
                  }`}
                >
                  {kirim ? "+" : "−"} {formatSom(t.summa)}
                  <span className="font-sans font-medium text-2xs text-faint ml-1">soʻm</span>
                </td>
                <td className="px-4 py-3 text-muted max-w-[220px] truncate" title={t.izoh ?? undefined}>
                  {t.izoh ?? "—"}
                  {/* MANBA: CRM — yozuv CRM buyurtmasidan ko'chirilgan. */}
                  {t.crmBuyurtma && (
                    <span className="ml-1.5 align-middle">
                      <Badge tone="info">CRM</Badge>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{t.user.ism}</td>
                {/* Amallar menyusi qator bosilishidan mustaqil. */}
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <AmalMenu
                    onBatafsil={() => onBatafsil(t)}
                    onTahrirlash={mumkin ? () => onTahrirlash(t) : undefined}
                    onOchirish={mumkin ? () => onOchirish(t) : undefined}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
