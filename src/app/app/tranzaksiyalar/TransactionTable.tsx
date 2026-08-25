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
              <tr key={t.id} className={`hover:bg-surface-2 ${selected.has(t.id) ? "bg-brand/5" : ""}`}>
                <td className="px-4 py-3">
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
                  <button
                    type="button"
                    onClick={() => onBatafsil(t)}
                    className="text-left font-medium text-fg hover:text-brand hover:underline"
                  >
                    {t.category.nomi}
                  </button>
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
                <td className="px-4 py-3 text-right">
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
