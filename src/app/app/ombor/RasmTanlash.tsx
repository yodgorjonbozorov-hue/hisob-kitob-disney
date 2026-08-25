"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";

/**
 * MAHSULOT RASMI — telefonda kamera yoki galereya, kompyuterda fayl tanlash.
 *
 * `capture` ATRIBUTI YO'Q: u telefonda galereyani BUTUNLAY yopib, faqat
 * kamerani ochadi. Foydalanuvchi ko'pincha rasmni oldindan olib qo'ygan
 * bo'ladi — shu bois `accept="image/*"` qoldirildi: iOS ham, Android ham
 * "Kamera / Galereya" tanlovini o'zi chiqaradi.
 *
 * SAQLAGICH SOZLANMAGAN bo'lsa fayl yuklash tugmasi ko'rsatilmaydi va
 * o'rniga havola maydoni chiqadi. Rasm `data:` URL sifatida bazaga
 * TIQILMAYDI — u har kartochka bilan yuzlab kilobayt bo'lib brauzerga
 * ketardi va zaxira hajmini ham shishirardi.
 */
export function RasmTanlash({
  qiymat,
  onChange,
}: {
  qiymat: string | null;
  onChange: (url: string | null) => void;
}) {
  const [yuklashMumkin, setYuklashMumkin] = useState<boolean | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [havolaRejim, setHavolaRejim] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let bekor = false;
    fetch("/api/ombor/rasm")
      .then((r) => (r.ok ? r.json() : { yuklashMumkin: false }))
      .then((d) => !bekor && setYuklashMumkin(Boolean(d.yuklashMumkin)))
      .catch(() => !bekor && setYuklashMumkin(false));
    return () => {
      bekor = true;
    };
  }, []);

  async function yukla(fayl: File) {
    setXato(null);
    setYuklanmoqda(true);
    try {
      const form = new FormData();
      form.append("rasm", fayl);
      const res = await fetch("/api/ombor/rasm", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setXato(data.error ?? "Rasmni yuklab bo'lmadi");
        if (res.status === 501) setHavolaRejim(true);
        return;
      }
      onChange(data.url as string);
    } finally {
      setYuklanmoqda(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 shrink-0 rounded-xl bg-surface-2 border border-line overflow-hidden flex items-center justify-center">
          {qiymat ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qiymat} alt="Mahsulot rasmi" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl text-faint" aria-hidden>
              &#128247;
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5 min-w-0">
          {yuklashMumkin !== false && !havolaRejim && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => input.current?.click()}
              loading={yuklanmoqda}
            >
              {qiymat ? "Rasmni almashtirish" : "\u{1F4F7} Rasm qo'shish"}
            </Button>
          )}
          {(yuklashMumkin === false || havolaRejim) && (
            <button
              type="button"
              onClick={() => setHavolaRejim(true)}
              className="text-xs text-brand hover:underline text-left"
            >
              Rasm havolasini kiritish
            </button>
          )}
          {qiymat && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-muted hover:text-expense text-left"
            >
              Rasmni olib tashlash
            </button>
          )}
        </div>
      </div>

      {(yuklashMumkin === false || havolaRejim) && (
        <input
          type="url"
          inputMode="url"
          value={qiymat ?? ""}
          onChange={(e) => onChange(e.target.value.trim() || null)}
          placeholder="https://... rasm manzili"
          className={INPUT_CLASS}
        />
      )}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void yukla(f);
        }}
      />

      {xato && <p className="text-xs text-expense">{xato}</p>}
    </div>
  );
}
