"use client";

import { formatMoney, formatDateUZ } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import type { BuyurtmaDTO } from "./turlar";

/**
 * Buyurtma kartasi (10-talab): kategoriya, xizmat, mijoz, telefon, narx,
 * sana + kirim holati. Balansa uslubi o'zgarmaydi — o'sha surface/line/brand
 * tokenlari.
 */
export function BuyurtmaKarta({
  b,
  holat,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  b: BuyurtmaDTO;
  /** Joriy CRM holati (bosqich nomi). */
  holat: string;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const kirimBor = Boolean(b.transactionId);

  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="w-full text-left bg-surface rounded-xl border border-line p-3 hover:border-brand/50 transition cursor-grab active:cursor-grabbing space-y-1"
    >
      {b.kategoriya && (
        <p className="text-2xs font-semibold text-brand uppercase tracking-wide truncate">
          {b.kategoriya}
        </p>
      )}
      <p className="text-sm font-medium text-fg truncate">{b.nomi}</p>
      {b.kontakt && <p className="text-xs text-muted truncate">{b.kontakt}</p>}
      {b.tel && <p className="text-xs text-faint truncate tnum">{b.tel}</p>}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        {b.summa > 0 ? (
          <span className="text-sm font-semibold text-fg tnum">{formatMoney(b.summa)}</span>
        ) : (
          <span className="text-xs text-faint">Narx yo&apos;q</span>
        )}
        {b.sana && (
          <span className="text-2xs text-faint tnum">{formatDateUZ(new Date(b.sana))}</span>
        )}
      </div>

      {/* SOTUVCHI (9-talab): bir qatorlik, ko'p joy egallamaydi. */}
      {b.sotuvchi && (
        <p className="text-2xs text-muted truncate">
          <span className="text-faint">Sotuvchi:</span>{" "}
          <span className="font-medium text-fg">{b.sotuvchi.ism}</span>
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <Badge tone={kirimBor ? "kirim" : "warning"}>
          {kirimBor ? "🟢 Kirim yozilgan" : "🟠 Kirim kutilmoqda"}
        </Badge>
        <Badge tone="neutral">{holat}</Badge>
      </div>
    </button>
  );
}
