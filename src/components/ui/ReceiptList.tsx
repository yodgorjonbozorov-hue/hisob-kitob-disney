"use client";

import { cn } from "@/lib/cn";
import { Money } from "@/components/ui/Money";
import { categoryVisual } from "@/lib/categoryVisual";
import { formatRelativeDay, formatSom } from "@/lib/format";
import { formatKgLabel } from "@/lib/kg";

export interface ReceiptItem {
  id: string;
  sana: string; // ISO
  turi: string; // kirim | chiqim
  summa: number;
  categoryNomi: string;
  izoh?: string | null;
  userIsm?: string | null;
  /** KG SAVDOSI (mijozga xos): miqdor grammda va o'sha savdodagi 1 kg narxi. */
  miqdorGr?: number | null;
  kgNarxi?: number | null;
}

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
function dayKey(iso: string): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + TASHKENT_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Signature: kassa lentasi (REDESIGN.md 4.5). Yozuvlar kun bo'yicha guruhlangan,
 * sticky kun sarlavhasi + kun sof natijasi, kun ostida perforatsiya, oxirida zigzag.
 */
export function ReceiptList({
  items,
  onRowClick,
  torn = true,
}: {
  items: ReceiptItem[];
  onRowClick?: (id: string) => void;
  torn?: boolean;
}) {
  // Kun bo'yicha guruhlash (Tashkent), kun ichida yangi birinchi.
  const groups: { key: string; sana: string; items: ReceiptItem[]; net: number }[] = [];
  for (const it of items) {
    const k = dayKey(it.sana);
    let g = groups.find((x) => x.key === k);
    if (!g) {
      g = { key: k, sana: it.sana, items: [], net: 0 };
      groups.push(g);
    }
    g.items.push(it);
    g.net += it.turi === "kirim" ? it.summa : -it.summa;
  }
  groups.sort((a, b) => (a.key < b.key ? 1 : -1));

  return (
    <div className="bg-surface rounded-xl border border-line overflow-hidden">
      {groups.map((g) => (
        <div key={g.key}>
          {/* Kun sarlavhasi (sticky) */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-surface-2/95 backdrop-blur border-b border-line">
            <span className="text-sm font-medium text-fg">{formatRelativeDay(new Date(g.sana))}</span>
            <Money value={g.net} size="sm" signed suffix={false} />
          </div>
          {/* Qatorlar */}
          <div>
            {g.items.map((it) => {
              const { Icon, color } = categoryVisual(it.categoryNomi);
              const inc = it.turi === "kirim";
              return (
                <button
                  key={it.id}
                  onClick={onRowClick ? () => onRowClick(it.id) : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition",
                    onRowClick && "hover:bg-surface-2 active:bg-surface-2"
                  )}
                >
                  <span
                    className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-fg font-medium truncate">{it.categoryNomi}</span>
                    {/* Kg savdosida "100 kg × 5 000" qatori tarixda YO'QOLMAYDI:
                        pul va og'irlik birga o'qiladi. */}
                    {it.miqdorGr != null && it.kgNarxi != null && (
                      <span className="block text-2xs text-muted tnum truncate">
                        {formatKgLabel(it.miqdorGr)} × {formatSom(it.kgNarxi)} soʻm
                      </span>
                    )}
                    <span className="block text-2xs text-faint truncate">
                      {it.izoh ? it.izoh : ""}
                      {it.izoh && it.userIsm ? " · " : ""}
                      {it.userIsm ?? ""}
                    </span>
                  </span>
                  <Money value={inc ? it.summa : -it.summa} size="md" signed suffix={false} />
                </button>
              );
            })}
          </div>
          {/* Perforatsiya (kun ajratgichi) */}
          <div className="receipt-perf mx-4" />
          <div className="h-3" />
        </div>
      ))}
      {/* Lenta oxiri — zigzag "yirilgan" chegara */}
      {torn && groups.length > 0 && (
        <div
          className="h-3 bg-surface"
          style={{
            WebkitMaskImage:
              "linear-gradient(45deg, transparent 33%, #000 33%, #000 66%, transparent 66%), linear-gradient(-45deg, transparent 33%, #000 33%, #000 66%, transparent 66%)",
            WebkitMaskSize: "12px 12px",
            WebkitMaskPosition: "0 100%, 6px 100%",
            maskImage:
              "linear-gradient(45deg, transparent 33%, #000 33%, #000 66%, transparent 66%), linear-gradient(-45deg, transparent 33%, #000 33%, #000 66%, transparent 66%)",
            maskSize: "12px 12px",
          }}
        />
      )}
    </div>
  );
}
