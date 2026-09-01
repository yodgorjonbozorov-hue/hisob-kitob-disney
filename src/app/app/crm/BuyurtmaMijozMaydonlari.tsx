"use client";

import { INPUT_KLASS } from "./formaUslub";

/**
 * Buyurtma formasining MIJOZ va NARX qatorlari — alohida komponent, chunki
 * "Yangi buyurtma" oynasi 250 satrlik chegarada qolishi kerak (CLAUDE.md).
 * Mantiq yo'q, faqat maydonlar.
 */
export function BuyurtmaMijozMaydonlari({
  kontaktIsm,
  setKontaktIsm,
  kontaktTel,
  setKontaktTel,
  summa,
  setSumma,
  sana,
  setSana,
}: {
  kontaktIsm: string;
  setKontaktIsm: (v: string) => void;
  kontaktTel: string;
  setKontaktTel: (v: string) => void;
  summa: string;
  setSumma: (v: string) => void;
  sana: string;
  setSana: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Mijoz ismi</span>
          <input
            value={kontaktIsm}
            onChange={(e) => setKontaktIsm(e.target.value)}
            placeholder="Ali"
            className={INPUT_KLASS}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Telefon</span>
          <input
            value={kontaktTel}
            onChange={(e) => setKontaktTel(e.target.value)}
            placeholder="+998 90 123 45 67"
            inputMode="tel"
            className={INPUT_KLASS}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Narx (so&apos;m)</span>
          <input
            value={summa}
            onChange={(e) => setSumma(e.target.value)}
            placeholder="500000"
            inputMode="numeric"
            className={INPUT_KLASS}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Buyurtma sanasi</span>
          <input
            type="date"
            value={sana}
            onChange={(e) => setSana(e.target.value)}
            className={INPUT_KLASS}
          />
        </label>
      </div>
    </>
  );
}
