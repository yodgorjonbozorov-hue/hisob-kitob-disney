"use client";

import { useEffect, useRef, useState } from "react";
import { formatSomLabel } from "@/lib/format";
import { telKorinish } from "@/lib/validation/qarz";

export interface MijozTaklif {
  contactId: string | null;
  ism: string;
  tel: string | null;
  ochiqQarz: number;
}

export interface MijozTanlov {
  contactId: string | null;
  ism: string;
  tel: string;
}

/**
 * MIJOZ TANLASH — qidiruv + "yangi mijoz" bitta maydonda.
 *
 * Ataylab alohida "yangi mijoz qo'shish" oynasi YO'Q: kassir qarz yozayotgan
 * paytda oyna ustiga oyna ochish ishni sekinlashtiradi. Yozgan matni mos
 * mijoz topmasa — o'sha matn yangi mijoz ismi bo'ladi va telefon maydoni
 * ochiladi.
 *
 * Mavjud mijoz tanlansa ism va telefon avtomatik to'ldiriladi va telefon
 * maydoni faqat o'qish uchun bo'lib qoladi (kartochkadagi raqam manba).
 */
export function MijozTanlash({
  qiymat,
  onChange,
  disabled,
}: {
  qiymat: MijozTanlov;
  onChange: (v: MijozTanlov) => void;
  disabled?: boolean;
}) {
  const [takliflar, setTakliflar] = useState<MijozTaklif[]>([]);
  const [ochiq, setOchiq] = useState(false);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Qidiruv "debounce" bilan — har harfda so'rov ketmasin.
  useEffect(() => {
    if (!ochiq) return;
    const t = setTimeout(async () => {
      setYuklanmoqda(true);
      try {
        const res = await fetch(`/api/debts/mijozlar?q=${encodeURIComponent(qiymat.ism)}`);
        if (res.ok) setTakliflar(await res.json());
      } catch {
        setTakliflar([]);
      } finally {
        setYuklanmoqda(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [qiymat.ism, ochiq]);

  // Tashqariga bosilganda ro'yxat yopiladi.
  useEffect(() => {
    function tashqari(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOchiq(false);
    }
    document.addEventListener("mousedown", tashqari);
    return () => document.removeEventListener("mousedown", tashqari);
  }, []);

  const tanlangan = qiymat.contactId !== null;

  return (
    <div className="space-y-3">
      <div ref={wrapRef} className="relative">
        <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-mijoz">
          Mijoz <span className="text-expense">*</span>
        </label>
        <div className="relative">
          <input
            id="qarz-mijoz"
            type="text"
            value={qiymat.ism}
            disabled={disabled}
            onChange={(e) => {
              // Ism qo'lda o'zgartirilsa kartochka bog'lanishi uziladi —
              // aks holda boshqa mijozning kartochkasiga qarz yozilardi.
              onChange({ contactId: null, ism: e.target.value, tel: tanlangan ? "" : qiymat.tel });
              setOchiq(true);
            }}
            onFocus={() => setOchiq(true)}
            placeholder="Mijozni tanlang yoki ism kiriting"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm pr-8"
            autoComplete="off"
          />
          {tanlangan && (
            <button
              type="button"
              onClick={() => onChange({ contactId: null, ism: "", tel: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-fg text-sm"
              aria-label="Mijozni tozalash"
            >
              ×
            </button>
          )}
        </div>

        {ochiq && (
          <div className="absolute z-40 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-line bg-surface shadow-card">
            {yuklanmoqda && takliflar.length === 0 && (
              <p className="px-3 py-2 text-xs text-faint">Qidirilmoqda...</p>
            )}
            {!yuklanmoqda && takliflar.length === 0 && (
              <p className="px-3 py-2 text-xs text-faint">
                Mos mijoz yo&apos;q — yangi mijoz sifatida yoziladi
              </p>
            )}
            {takliflar.map((m) => (
              <button
                key={m.contactId ?? `ism:${m.ism}`}
                type="button"
                onClick={() => {
                  onChange({ contactId: m.contactId, ism: m.ism, tel: m.tel ?? "" });
                  setOchiq(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-line last:border-0"
              >
                <span className="block text-sm text-fg">{m.ism}</span>
                <span className="flex justify-between gap-2 text-2xs text-muted">
                  <span>{m.tel ? telKorinish(m.tel) : "telefonsiz"}</span>
                  {m.ochiqQarz > 0 && (
                    <span className="text-debt">ochiq qarz {formatSomLabel(m.ochiqQarz)}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1" htmlFor="qarz-tel">
          Telefon <span className="text-expense">*</span>
        </label>
        <input
          id="qarz-tel"
          type="tel"
          inputMode="tel"
          value={qiymat.tel}
          disabled={disabled || tanlangan}
          onChange={(e) => onChange({ ...qiymat, tel: e.target.value })}
          placeholder="+998 __ ___ __ __"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm disabled:bg-surface-2 disabled:text-muted"
        />
        {tanlangan && (
          <p className="text-2xs text-faint mt-1">Mijoz kartochkasidan olindi</p>
        )}
      </div>
    </div>
  );
}
