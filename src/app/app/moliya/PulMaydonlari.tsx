"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { formatSom } from "@/lib/format";
import { INPUT_CLASS, LABEL_CLASS } from "@/components/ui/fieldStyles";
import { PUL_USULLARI, PUL_USULI_BELGI, PUL_USULI_NOMI } from "@/lib/moliya/usul";
import type { KassaOption, PulFormasi } from "./turlar";

export interface SababVarianti {
  value: string;
  label: string;
}

/**
 * FORMANING QOLGAN MAYDONLARI: sabab → summa → to'lov usuli → kassa.
 *
 * Oynadan (`PulModal`) ajratilgan: oyna faqat tomon, qarz ko'rinishi va
 * yuborishni boshqaradi, maydonlar esa shu yerda — komponent 250 satrdan
 * oshmasligi loyiha qoidasi.
 */
export function PulMaydonlari({
  forma,
  ozgart,
  summa,
  sababVariantlari,
  sababQiymati,
  kassalar,
  disabled,
}: {
  forma: PulFormasi;
  ozgart: (qism: Partial<PulFormasi>) => void;
  summa: number;
  sababVariantlari: SababVarianti[];
  sababQiymati: string;
  kassalar: KassaOption[];
  disabled: boolean;
}) {
  const [qoshimcha, setQoshimcha] = useState(false);
  const kirim = forma.yonalish === "kirim";

  return (
    <>
      <div>
        <label className={LABEL_CLASS} htmlFor="moliya-sabab">
          Nima uchun? <span className="text-expense">*</span>
        </label>
        <Select
          id="moliya-sabab"
          value={sababQiymati}
          onChange={(v) =>
            ozgart(
              v.startsWith("sabab:")
                ? { sababKod: v.slice(6), categoryId: "" }
                : { sababKod: "", categoryId: v.slice(4) }
            )
          }
          options={sababVariantlari}
          placeholder="Sababni tanlang"
          searchable={sababVariantlari.length > 8}
          disabled={disabled}
        />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="moliya-summa">
          Summa <span className="text-expense">*</span>
        </label>
        <input
          id="moliya-summa"
          type="text"
          inputMode="numeric"
          value={forma.summa}
          disabled={disabled}
          onChange={(e) => ozgart({ summa: e.target.value })}
          placeholder="0"
          className={`${INPUT_CLASS} text-xl font-semibold tnum`}
        />
        {summa > 0 && (
          <p className="text-xs text-muted mt-1 tnum">{formatSom(summa)} so&apos;m</p>
        )}
      </div>

      <div>
        <span className={LABEL_CLASS}>To&apos;lov usuli</span>
        <div className="grid grid-cols-2 gap-2">
          {PUL_USULLARI.map((u) => (
            <button
              key={u}
              type="button"
              disabled={disabled}
              // Usul almashsa kassa tanlovi bo'shatiladi: server usulga MOS
              // kassani o'zi topadi (naqd → naqd kassa, o'tkazma → bank).
              onClick={() => ozgart({ usul: u, accountId: "" })}
              className={`min-h-[44px] rounded-lg border px-2 text-sm transition ${
                forma.usul === u
                  ? "border-brand bg-brand-wash text-brand font-medium"
                  : "border-line text-muted hover:border-line-strong"
              }`}
            >
              {PUL_USULI_BELGI[u]} {PUL_USULI_NOMI[u]}
            </button>
          ))}
        </div>
      </div>

      {/* Kassa qadami bitta kassali bizneslarda ko'rsatilmaydi — u yerda
          tanlov yo'q va qo'shimcha bosish faqat sekinlashtiradi. */}
      {kassalar.length > 1 && (
        <div>
          <label className={LABEL_CLASS} htmlFor="moliya-kassa">
            {kirim ? "Qaysi kassaga?" : "Qaysi kassadan?"}
          </label>
          <Select
            id="moliya-kassa"
            value={forma.accountId}
            onChange={(v) => ozgart({ accountId: v })}
            options={[
              { value: "", label: "Usulga mos kassa (avtomatik)" },
              ...kassalar.map((k) => ({ value: k.id, label: k.nomi, tavsif: k.turi })),
            ]}
            disabled={disabled}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setQoshimcha((v) => !v)}
        className="text-xs text-brand font-medium"
      >
        {qoshimcha ? "− Qo'shimcha maydonlarni yashirish" : "+ Sana va izoh"}
      </button>

      {qoshimcha && (
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="moliya-sana">
              Sana
            </label>
            <input
              id="moliya-sana"
              type="date"
              value={forma.sana}
              disabled={disabled}
              onChange={(e) => ozgart({ sana: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="moliya-izoh">
              Izoh
            </label>
            <input
              id="moliya-izoh"
              type="text"
              value={forma.izoh}
              disabled={disabled}
              onChange={(e) => ozgart({ izoh: e.target.value })}
              placeholder="Ixtiyoriy"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}
    </>
  );
}
