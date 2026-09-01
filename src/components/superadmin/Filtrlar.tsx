"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { Select } from "@/components/ui/Select";

/**
 * FILTR PANELI — holat URL'da.
 *
 * Nega URL: filtrlangan ko'rinishni hamkasbga havola bilan yuborish mumkin,
 * orqaga tugmasi kutilgandek ishlaydi va server komponent ma'lumotni
 * to'g'ridan-to'g'ri shu parametrlar bo'yicha oladi (client-side filtrlash
 * umuman yo'q — 100 000 yozuv brauzerga tushmaydi).
 */

export interface TanlovFiltr {
  kalit: string;
  label: string;
  variantlar: { qiymat: string; label: string }[];
}

export function Filtrlar({
  qidiruvPlaceholder = "Qidirish...",
  tanlovlar = [],
  qoshimcha,
}: {
  qidiruvPlaceholder?: string;
  tanlovlar?: TanlovFiltr[];
  qoshimcha?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [qidiruv, setQidiruv] = useState(params.get("qidiruv") ?? "");

  // URL tashqaridan o'zgarsa (orqaga tugmasi) maydon ham yangilanadi.
  useEffect(() => {
    setQidiruv(params.get("qidiruv") ?? "");
  }, [params]);

  function yangila(kalit: string, qiymat: string) {
    const p = new URLSearchParams(params.toString());
    if (qiymat) p.set(kalit, qiymat);
    else p.delete(kalit);
    // Filtr o'zgarganda birinchi sahifaga qaytiladi — aks holda 7-sahifada
    // "hech narsa yo'q" ko'rinardi.
    p.delete("sahifa");
    router.push(`${pathname}?${p.toString()}`);
  }

  function qidiruvniYubor(e: FormEvent) {
    e.preventDefault();
    yangila("qidiruv", qidiruv.trim());
  }

  const bandFiltrlar = [...params.keys()].filter((k) => k !== "sahifa" && k !== "limit");

  const maydon =
    "h-9 rounded-lg border border-line bg-surface px-3 text-sm text-fg " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={qidiruvniYubor} className="flex-1 min-w-[200px]">
        <label className="sr-only" htmlFor="sa-qidiruv">
          {qidiruvPlaceholder}
        </label>
        <input
          id="sa-qidiruv"
          type="search"
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder={qidiruvPlaceholder}
          className={`${maydon} w-full`}
        />
      </form>

      {tanlovlar.map((t) => (
        <div key={t.kalit} className="min-w-[150px]">
          <label className="sr-only" htmlFor={`filtr-${t.kalit}`}>
            {t.label}
          </label>
          <Select
            id={`filtr-${t.kalit}`}
            value={params.get(t.kalit) ?? ""}
            onChange={(v) => yangila(t.kalit, v)}
            options={[
              { value: "", label: `${t.label}: hammasi` },
              ...t.variantlar.map((v) => ({ value: v.qiymat, label: v.label })),
            ]}
          />
        </div>
      ))}

      {qoshimcha}

      {bandFiltrlar.length > 0 && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-2xs text-muted underline underline-offset-4 hover:text-fg"
        >
          Tozalash ({bandFiltrlar.length})
        </button>
      )}
    </div>
  );
}
