"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { XodimKategoriyaDTO, ZakazXodimDTO } from "./turlar";
import { XodimTanlovSheet } from "./XodimTanlovSheet";

/**
 * ZAKAZ JAMOASI — zakazni BAJARADIGAN xodimlar (Animator, Shofyor, Diktor,
 * Videochilar, Bezakchilar, Dizayner...). Lavozimlar ro'yxati biznes
 * sozlamasidan keladi (qattiq kod YO'Q — 7-talab): yangi lavozim
 * qo'shilsa forma o'z-o'zidan kengayadi.
 *
 * SOTUVCHI BU YERDA CHIQMAYDI: u alohida birinchi darajali maydon
 * (`SotuvchiTanlash`) — "zakazni kim oldi" va "kim bajaradi" ikki boshqa
 * savol.
 *
 * MOBIL (34-talab): butun bo'lim yig'iladigan (collapsible) — forma uzayib
 * ketmaydi; har lavozim qatori bosilganda qidiruvli varaq ochiladi.
 */

/** Ijrochi lavozimlar — sotuvchi turidagilar chiqarib tashlanadi. */
export function ijroKategoriyalari(kategoriyalar: XodimKategoriyaDTO[]): XodimKategoriyaDTO[] {
  return kategoriyalar.filter((k) => k.turi !== "sotuvchi");
}

/** categoryId → employeeId[] (bo'sh — tanlanmagan). */
export type ZakazXodimTanlov = Record<string, string[]>;

/** Tanlovni API kutadigan ro'yxatga aylantiradi. */
export function tanlovdanRoyxat(t: ZakazXodimTanlov): { categoryId: string; employeeId: string }[] {
  return Object.entries(t).flatMap(([categoryId, ids]) => ids.map((employeeId) => ({ categoryId, employeeId })));
}

/**
 * Mavjud biriktiruvlardan tanlov (tahrirlash uchun). Sotuvchi qatorlari
 * chiqariladi — u alohida maydondan boshqariladi.
 */
export function biriktiruvdanTanlov(xodimlar: ZakazXodimDTO[]): ZakazXodimTanlov {
  const t: ZakazXodimTanlov = {};
  for (const x of xodimlar) {
    if (x.kategoriyaTuri === "sotuvchi") continue;
    (t[x.categoryId] ??= []).push(x.employeeId);
  }
  return t;
}

export function tanlanganSoni(t: ZakazXodimTanlov): number {
  return Object.values(t).reduce((s, ids) => s + ids.length, 0);
}

export function ZakazJamoasiTanlash({
  kategoriyalar,
  tanlov,
  onChange,
  boshidaOchiq = false,
}: {
  kategoriyalar: XodimKategoriyaDTO[];
  tanlov: ZakazXodimTanlov;
  onChange: (t: ZakazXodimTanlov) => void;
  boshidaOchiq?: boolean;
}) {
  const [ochiq, setOchiq] = useState(boshidaOchiq);
  const [varaq, setVaraq] = useState<XodimKategoriyaDTO | null>(null);
  if (kategoriyalar.length === 0) return null;

  const soni = tanlanganSoni(tanlov);

  return (
    <div className="rounded-xl border border-line">
      <button
        type="button"
        onClick={() => setOchiq((o) => !o)}
        aria-expanded={ochiq}
        className="w-full flex items-center justify-between gap-2 px-3 min-h-[44px] text-left"
      >
        <span className="text-2xs uppercase tracking-wide text-faint">Zakaz jamoasi</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          {soni > 0 ? `${soni} xodim` : "Tanlanmagan"}
          {ochiq ? (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          )}
        </span>
      </button>

      {ochiq && (
        <ul className="divide-y divide-line border-t border-line">
          {kategoriyalar.map((k) => {
            const ids = tanlov[k.id] ?? [];
            const ismlar = ids.map((id) => k.azolar.find((a) => a.id === id)?.ism ?? "Nofaol xodim");
            return (
              <li key={k.id}>
                <button
                  type="button"
                  onClick={() => setVaraq(k)}
                  className="w-full flex items-center justify-between gap-3 px-3 min-h-[44px] py-2 text-left hover:bg-surface-2 transition"
                >
                  <span className="text-sm text-muted shrink-0">
                    {k.nomi}
                    {k.kopXodim && <span className="text-2xs text-faint"> · bir nechta</span>}
                  </span>
                  <span className={`text-sm text-right truncate ${ismlar.length ? "font-medium text-fg" : "text-faint"}`}>
                    {ismlar.length ? ismlar.join(", ") : k.kopXodim ? `+ ${k.nomi} tanlash` : "Tanlanmagan"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {varaq && (
        <XodimTanlovSheet
          sarlavha={varaq.nomi}
          azolar={varaq.azolar}
          tanlangan={tanlov[varaq.id] ?? []}
          kop={varaq.kopXodim}
          onDone={(ids) => {
            onChange({ ...tanlov, [varaq.id]: ids });
            setVaraq(null);
          }}
          onClose={() => setVaraq(null)}
        />
      )}
    </div>
  );
}
