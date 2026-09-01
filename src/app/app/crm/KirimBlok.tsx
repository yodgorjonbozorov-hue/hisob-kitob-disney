"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { kirimHavolasi, type BuyurtmaDTO } from "./turlar";

/**
 * Tafsilot oynasining KIRIM bloki: yozilgan bo'lsa havola, bo'lmasa
 * "Kirimga o'tkazish" tugmasi. Alohida komponent — tafsilot oynasi 250
 * satrlik chegarada qolsin (CLAUDE.md).
 */
export function KirimBlok({
  b,
  kirimBor,
  onOtkazish,
  onClose,
}: {
  b: BuyurtmaDTO;
  kirimBor: boolean;
  onOtkazish: () => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3 space-y-2">
      {kirimBor ? (
        <>
          <Badge tone="kirim">🟢 Kirim yozilgan</Badge>
          <p className="text-xs text-muted">
            Bu buyurtma bo&apos;yicha kirim allaqachon yozilgan — takroriy yozib bo&apos;lmaydi.
          </p>
          <Link href={kirimHavolasi(b)} className="inline-block text-brand text-sm font-medium" onClick={onClose}>
            Kirim yozuvini ochish →
          </Link>
        </>
      ) : (
        <>
          <Badge tone="warning">🟠 Kirim kutilmoqda</Badge>
          <p className="text-xs text-muted">
            To&apos;lov olingach kirimga o&apos;tkazing — Kirim bo&apos;limida oddiy yozuv sifatida
            paydo bo&apos;ladi.
          </p>
          <button
            onClick={onOtkazish}
            disabled={b.summa <= 0}
            className="w-full rounded-lg bg-income text-white text-sm font-medium py-2 disabled:opacity-50"
          >
            Kirimga o&apos;tkazish
          </button>
          {b.summa <= 0 && <p className="text-2xs text-faint">Avval buyurtma narxini kiriting.</p>}
        </>
      )}
    </div>
  );
}
