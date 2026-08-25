"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { CategoryOption } from "./turlar";

/**
 * KATEGORIYA TANLOV — dropdown emas, bir bosishda tanlanadigan katakchalar.
 *
 * Ikki narsa tezlashtiradi:
 *   1. "Ko'p ishlatiladigan" — REAL tarixdan (`getTezKategoriyalar`) chiqadi va
 *      tepada turadi. Bu FAQAT tartib: kategoriya qoidalari o'zgarmaydi.
 *   2. Qidiruv — kategoriyalar ko'payganda (20+) ro'yxatni aylantirish o'rniga
 *      ikki harf yozib topiladi. Kam kategoriyada maydon umuman chiqmaydi.
 *
 * Ro'yxatga FAQAT tanlangan turga (kirim/chiqim) mos kategoriyalar keladi —
 * chaqiruvchi filtrlab beradi.
 */

const QIDIRUV_CHEGARASI = 8;

export function KategoriyaTanlov({
  kategoriyalar,
  qiymat,
  onChange,
  tezIdlar = [],
  disabled = false,
}: {
  kategoriyalar: CategoryOption[];
  qiymat: string;
  onChange: (id: string) => void;
  /** Ko'p ishlatiladiganlar — tartib bo'yicha id ro'yxati. */
  tezIdlar?: string[];
  disabled?: boolean;
}) {
  const [qidiruv, setQidiruv] = useState("");

  const tez = useMemo(
    () =>
      tezIdlar
        .map((id) => kategoriyalar.find((c) => c.id === id))
        .filter((c): c is CategoryOption => !!c)
        .slice(0, 4),
    [tezIdlar, kategoriyalar]
  );

  const korinadigan = useMemo(() => {
    const s = qidiruv.trim().toLowerCase();
    if (!s) return kategoriyalar;
    return kategoriyalar.filter((c) => c.nomi.toLowerCase().includes(s));
  }, [kategoriyalar, qidiruv]);

  if (kategoriyalar.length === 0) {
    return (
      <div>
        <p className="text-sm font-medium text-fg mb-1.5">Kategoriya</p>
        <p className="text-sm text-muted rounded-lg bg-surface-2 px-3 py-2.5">
          Bu tur uchun kategoriya yo&apos;q. Avval sozlamalarda kategoriya qo&apos;shing.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-fg mb-1.5" htmlFor="tx-kategoriya-qidiruv">
        Kategoriya
      </label>

      {kategoriyalar.length > QIDIRUV_CHEGARASI && (
        <input
          id="tx-kategoriya-qidiruv"
          type="text"
          value={qidiruv}
          disabled={disabled}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Kategoriya qidirish..."
          className="w-full mb-2 rounded-lg border border-line bg-surface text-fg px-3 py-2.5 text-base
            min-h-[44px] placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
        />
      )}

      {tez.length > 0 && !qidiruv.trim() && (
        <div className="mb-2">
          <p className="text-2xs text-faint mb-1.5">Ko&apos;p ishlatiladigan</p>
          <div className="flex flex-wrap gap-2">
            {tez.map((c) => (
              <Katak key={c.id} nomi={c.nomi} faol={qiymat === c.id} disabled={disabled} onClick={() => onChange(c.id)} />
            ))}
          </div>
        </div>
      )}

      {/* To'liq ro'yxat sarlavhasi — "Ko'p ishlatiladigan" katakchalari
          pastdagi ro'yxatda TAKRORLANADI (ular o'sha ro'yxatning bir qismi).
          Sarlavhasiz bu takror xatodek ko'rinardi. */}
      {tez.length > 0 && !qidiruv.trim() && (
        <p className="text-2xs text-faint mb-1.5">Barcha kategoriyalar</p>
      )}
      <div
        data-test="kategoriya-royxat"
        className="max-h-52 overflow-y-auto overscroll-contain rounded-lg border border-line p-2"
      >
        {korinadigan.length === 0 ? (
          <p className="text-sm text-muted px-1 py-2">Topilmadi</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {korinadigan.map((c) => (
              <Katak key={c.id} nomi={c.nomi} faol={qiymat === c.id} disabled={disabled} onClick={() => onChange(c.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Katak({
  nomi,
  faol,
  disabled,
  onClick,
}: {
  nomi: string;
  faol: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={faol}
      className={cn(
        "px-3 py-2 rounded-lg border text-sm min-h-[44px] text-left transition active:scale-[0.98] disabled:opacity-50",
        faol
          ? "border-brand bg-brand-wash text-brand font-medium"
          : "border-line bg-surface text-fg hover:border-brand"
      )}
    >
      {nomi}
    </button>
  );
}
