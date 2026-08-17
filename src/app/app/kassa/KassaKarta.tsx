"use client";

import Link from "next/link";
import { Money } from "@/components/ui/Money";
import { ACCOUNT_TURI_NOMI, type AccountTuri } from "@/lib/validation/account";
import type { AccountQoldiq, KassaKunlik } from "@/lib/queries/accounts";

/** Kassa turi belgisi — ro'yxatda darrov ajralib tursin. */
const TURI_BELGI: Record<string, string> = { naqd: "💵", plastik: "💳", bank: "🏦" };

/**
 * BITTA KASSA KARTASI — dashboard ko'rinishi.
 *
 * Kassir bir qarashda uchta savolga javob olishi kerak: qancha pul bor,
 * bugun qancha tushdi, kimniki. Batafsili — kartani bosganda ochiladigan
 * detal sahifasida (harakatlar tarixi bilan).
 */
export function KassaKarta({
  kassa,
  kunlik,
  meniki,
  onTahrir,
}: {
  kassa: AccountQoldiq;
  kunlik: KassaKunlik | undefined;
  /** Shu kassa joriy foydalanuvchiniki — ajratib ko'rsatiladi. */
  meniki: boolean;
  /** Boshqaruvchi bo'lsa — kassani tahrirlash tugmasi. */
  onTahrir?: () => void;
}) {
  return (
    <div
      className={`relative bg-surface border rounded-2xl p-5 transition ${
        meniki ? "border-brand" : "border-line"
      } ${kassa.isActive ? "" : "opacity-60"}`}
    >
      <Link
        href={`/app/kassa/${kassa.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-fg truncate">
            {kassa.userId ? "👤" : TURI_BELGI[kassa.turi] ?? "💰"} {kassa.nomi}
          </p>
          {meniki && <span className="text-2xs text-brand shrink-0">sizniki</span>}
          {!kassa.isActive && <span className="text-2xs text-faint shrink-0">nofaol</span>}
        </div>
        <p className="text-2xs text-faint mt-0.5 truncate">
          {kassa.userId
            ? (kassa.egaIsm ?? "egasi o'chirilgan")
            : (ACCOUNT_TURI_NOMI[kassa.turi as AccountTuri] ?? kassa.turi)}
        </p>

        <div className="mt-3">
          <Money value={kassa.qoldiq} size="xl" tone={kassa.qoldiq >= 0 ? "neutral" : "expense"} />
        </div>

        <div className="mt-3 pt-3 border-t border-line space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-muted">Bugungi kirim</span>
            <Money value={kunlik?.kirim ?? 0} size="sm" tone="income" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-2xs text-muted">Bugungi chiqim</span>
            <Money value={kunlik?.chiqim ?? 0} size="sm" tone="expense" />
          </div>
        </div>
      </Link>

      {onTahrir && (
        <button
          type="button"
          onClick={onTahrir}
          className="absolute top-4 right-4 text-2xs text-faint hover:text-brand"
        >
          Tahrirlash
        </button>
      )}
    </div>
  );
}
