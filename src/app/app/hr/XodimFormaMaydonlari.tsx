"use client";

import { RasmTanlash } from "../ombor/RasmTanlash";
import { Select } from "@/components/ui/Select";
import { STAVKA_TURLARI, STAVKA_NOMI, type StavkaTuri } from "@/lib/validation/hr";

export const XODIM_INPUT = "w-full px-3 py-2 rounded-lg bg-surface-2 border border-line text-fg";

/** Xodim formasining asosiy maydonlari (XodimModal'dan ajratilgan — 250 satr qoidasi). */
export function XodimFormaMaydonlari({
  ism,
  setIsm,
  lavozim,
  setLavozim,
  tel,
  setTel,
  rasmUrl,
  setRasmUrl,
  stavka,
  setStavka,
  stavkaTuri,
  setStavkaTuri,
}: {
  ism: string;
  setIsm: (v: string) => void;
  lavozim: string;
  setLavozim: (v: string) => void;
  tel: string;
  setTel: (v: string) => void;
  rasmUrl: string | null;
  setRasmUrl: (v: string | null) => void;
  stavka: string;
  setStavka: (v: string) => void;
  stavkaTuri: StavkaTuri;
  setStavkaTuri: (v: StavkaTuri) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm text-muted mb-1" htmlFor="x-ism">
          Ism
        </label>
        <input id="x-ism" value={ism} onChange={(e) => setIsm(e.target.value)} required maxLength={120} className={XODIM_INPUT} />
      </div>

      <div>
        <span className="block text-sm text-muted mb-1">Rasm</span>
        <RasmTanlash qiymat={rasmUrl} onChange={setRasmUrl} endpoint="/api/hr/rasm" yorliq="Xodim rasmi" />
        <p className="text-2xs text-faint mt-1">Rasm bo&apos;lmasa bosh harfli avatar ko&apos;rsatiladi.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="x-lavozim">
            Lavozim
          </label>
          <input id="x-lavozim" value={lavozim} onChange={(e) => setLavozim(e.target.value)} maxLength={100} className={XODIM_INPUT} />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="x-tel">
            Telefon
          </label>
          <input id="x-tel" value={tel} onChange={(e) => setTel(e.target.value)} maxLength={50} className={XODIM_INPUT} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="x-stavka">
            Oylik / stavka (so&apos;m)
          </label>
          <input
            id="x-stavka"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={stavka}
            onChange={(e) => setStavka(e.target.value)}
            className={XODIM_INPUT}
          />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1" htmlFor="x-turi">
            Stavka turi
          </label>
          <Select
            id="x-turi"
            value={stavkaTuri}
            onChange={(v) => setStavkaTuri(v as StavkaTuri)}
            options={STAVKA_TURLARI.map((t) => ({ value: t, label: STAVKA_NOMI[t] }))}
          />
        </div>
      </div>
      <p className="text-2xs text-faint">
        Kunlik stavkada oylik davomat jadvalidan hisoblanadi; oylik stavkada esa to&apos;liq
        stavka olinadi va kam ishlagani &laquo;ushlab qolish&raquo; bilan hisobga olinadi.
      </p>
    </>
  );
}
