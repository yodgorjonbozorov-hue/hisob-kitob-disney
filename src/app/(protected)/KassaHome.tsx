"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Money } from "@/components/ui/Money";
import { ReceiptList, type ReceiptItem } from "@/components/ui/ReceiptList";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuickAddSheet } from "@/components/nav/QuickAddSheet";
import type { Rol } from "@/lib/auth/session";

/**
 * Kassir bosh ekrani (REDESIGN.md 5.1) — dashboard EMAS. BUGUN jami + ikkita
 * katta tugma (Pul kirdi / Pul chiqdi) → keypad sheet. Ostida kassa lentasi.
 */
export function KassaHome({
  ism,
  rol,
  businessNomi,
  bugun,
  recent,
}: {
  ism: string;
  rol: Rol;
  businessNomi: string;
  bugun: { kirim: number; chiqim: number };
  recent: ReceiptItem[];
}) {
  const [sheet, setSheet] = useState<null | "kirim" | "chiqim">(null);

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <p className="text-sm text-muted">{businessNomi}</p>
        <h1 className="text-xl font-display font-bold text-fg">Salom, {ism}</h1>
      </div>

      {/* BUGUN */}
      <div className="bg-surface rounded-xl border border-line p-5 shadow-card">
        <p className="text-2xs text-faint uppercase tracking-wide mb-3">Bugun</p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted">Kirdi</span>
          <Money value={bugun.kirim} size="xl" tone="income" signed={false} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Chiqdi</span>
          <Money value={bugun.chiqim} size="xl" tone="expense" signed={false} />
        </div>
      </div>

      {/* Katta tugmalar */}
      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={() => setSheet("kirim")}
          className="w-full min-h-[88px] rounded-xl bg-income text-white flex items-center justify-center gap-3 text-lg font-semibold active:scale-[0.99] transition shadow-card"
        >
          <ArrowDownLeft className="w-7 h-7" /> Pul kirdi
        </button>
        <button
          onClick={() => setSheet("chiqim")}
          className="w-full min-h-[88px] rounded-xl bg-expense text-white flex items-center justify-center gap-3 text-lg font-semibold active:scale-[0.99] transition shadow-card"
        >
          <ArrowUpRight className="w-7 h-7" /> Pul chiqdi
        </button>
      </div>

      {/* Oxirgi yozuvlar */}
      <div>
        <p className="text-sm font-medium text-fg mb-2">Oxirgi yozuvlar</p>
        {recent.length === 0 ? (
          <div className="bg-surface rounded-xl border border-line">
            <EmptyState title="Hali yozuv yo'q" description="Yuqoridagi tugma bilan birinchi yozuvni qo'shing." icon="🧾" />
          </div>
        ) : (
          <ReceiptList items={recent} />
        )}
      </div>

      <QuickAddSheet open={sheet !== null} onClose={() => setSheet(null)} rol={rol} defaultTuri={sheet ?? "kirim"} />
    </div>
  );
}
