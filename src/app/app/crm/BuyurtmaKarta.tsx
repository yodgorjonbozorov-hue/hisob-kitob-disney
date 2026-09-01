"use client";

import { formatMoney, formatDateUZ } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { kechikkanKun, tolovHolati, TOLOV_HOLAT_NOMI, type Ustun } from "@/lib/crm/pipeline";
import type { BuyurtmaDTO } from "./turlar";

/** Ustun bo'yicha workflow belgisi — kartada zakaz qayerda turgani ko'rinsin. */
const USTUN_BELGISI: Record<Ustun, { matn: string; tone: "kirim" | "warning" | "info" | "neutral" }> = {
  KUTILAYOTGAN: { matn: "⚪ Kutilayotgan", tone: "neutral" },
  BUGUNGI: { matn: "🔵 Bugungi zakaz", tone: "info" },
  JARAYONDA: { matn: "🟡 Jarayonda", tone: "warning" },
  YUTILDI: { matn: "🟢 Yutildi", tone: "kirim" },
  YOQOTILDI: { matn: "⚫ Yo'qotildi", tone: "neutral" },
};

const TOLOV_BELGISI: Record<string, { matn: string; tone: "kirim" | "warning" | "chiqim" }> = {
  TOLANGAN: { matn: "🟢 To'langan", tone: "kirim" },
  QISMAN: { matn: "🟠 Qisman to'langan", tone: "warning" },
  QARZ: { matn: "🔴 Qarzga", tone: "chiqim" },
};

/**
 * ZAKAZ KARTASI (9-talab): kategoriya, nomi, mijoz, telefon, narx, zakaz
 * sanasi, sotuvchi, to'lov belgisi va workflow belgisi.
 *
 * KECHIKKAN zakaz (7-talab) shu yerda qizil belgi oladi — u ustundan
 * chiqib ketmaydi, aksincha ko'zga tashlanadi.
 */
export function BuyurtmaKarta({
  b,
  ustun,
  bugun,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  b: BuyurtmaDTO;
  ustun: Ustun;
  /** Bugungi sana "YYYY-MM-DD" (Asia/Tashkent, server tomondan). */
  bugun: string;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const kechikkan = kechikkanKun(b.holat, b.sana, bugun);
  const tolov = tolovHolati(b.summa, b.tolangan);
  const belgi = USTUN_BELGISI[ustun];

  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`w-full text-left bg-surface rounded-xl border p-3 hover:border-brand/50 transition cursor-grab active:cursor-grabbing space-y-1 ${
        kechikkan > 0 ? "border-expense/60" : "border-line"
      }`}
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
          <span className="text-2xs text-faint tnum">
            {b.sana === bugun ? "Bugun" : formatDateUZ(new Date(b.sana))}
          </span>
        )}
      </div>

      {b.masulIsm && <p className="text-2xs text-faint truncate">Sotuvchi: {b.masulIsm}</p>}

      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        {kechikkan > 0 && (
          <Badge tone="chiqim">🔴 {kechikkan} kun kechikkan</Badge>
        )}
        <Badge tone={TOLOV_BELGISI[tolov].tone}>{TOLOV_BELGISI[tolov].matn}</Badge>
        <Badge tone={belgi.tone}>{belgi.matn}</Badge>
        {ustun === "YUTILDI" && b.kirimSumma > 0 && (
          <Badge tone="kirim">Kirim {formatMoney(b.kirimSumma)}</Badge>
        )}
        {b.qarzQoldiq > 0 && <Badge tone="chiqim">Qarz {formatMoney(b.qarzQoldiq)}</Badge>}
      </div>
      {tolov === "QISMAN" && (
        <p className="text-2xs text-faint tnum">
          {TOLOV_HOLAT_NOMI.QISMAN}: {formatMoney(b.tolangan)} / {formatMoney(b.summa)}
        </p>
      )}
    </button>
  );
}
