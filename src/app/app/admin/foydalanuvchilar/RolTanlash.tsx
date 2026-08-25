"use client";

import { cn } from "@/lib/cn";
import type { RolVariant } from "./turlar";

/**
 * ROL TANLAGICH — nom ostida bir qatorli izoh.
 *
 * Oddiy `<select>` da "Kassir" va "Sotuvchi" biznes egasi uchun farqsiz
 * so'zlar: u nimani tanlayotganini nomdan bilmaydi. Shu bois har variant
 * kartochka bo'lib chiqadi va izoh YONIDA turadi — tanlashdan OLDIN
 * o'qiladi.
 *
 * Izohlar huquq ro'yxati emas: haqiqiy huquqlar "Rollar va huquqlar"
 * bo'limida, maxsus rollarda esa izoh o'sha roldan olinadi (`turlar.ts`).
 */
export function RolTanlash({
  variantlar,
  qiymat,
  onChange,
  disabled,
}: {
  variantlar: RolVariant[];
  qiymat: string;
  onChange: (q: string) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Rol" className="space-y-2">
      {variantlar.map((v) => {
        const tanlangan = v.qiymat === qiymat;
        return (
          <button
            key={v.qiymat}
            type="button"
            role="radio"
            aria-checked={tanlangan}
            disabled={disabled}
            onClick={() => onChange(v.qiymat)}
            className={cn(
              "w-full text-left rounded-xl border px-3 py-2.5 min-h-[44px] transition",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              tanlangan
                ? "border-brand bg-brand-wash"
                : "border-line bg-surface hover:border-brand/50"
            )}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "w-4 h-4 shrink-0 rounded-full border-2 grid place-items-center",
                  tanlangan ? "border-brand" : "border-line"
                )}
              >
                {tanlangan && <span className="w-2 h-2 rounded-full bg-brand" />}
              </span>
              <span className="font-medium text-fg text-sm">{v.nomi}</span>
            </span>
            <span className="block text-2xs text-muted mt-0.5 pl-6">{v.izoh}</span>
          </button>
        );
      })}
    </div>
  );
}
