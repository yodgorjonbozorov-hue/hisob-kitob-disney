"use client";

import { useEffect, useRef, useState } from "react";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { formatSom } from "@/lib/format";
import type { OmborMahsulotDTO } from "@/lib/queries/ombor";

/**
 * MAHSULOT TANLASH — server tomonda qidiriladi.
 *
 * Butun katalogni brauzerga yuklab, keyin `filter()` bilan qidirish 1000+
 * tovarda telefonda sekin ishlaydi va har oyna ochilishida megabaytlarcha
 * JSON tortadi. Bu yerda har yozuvdan keyin 250 ms kutiladi va faqat 20 ta
 * natija so'raladi.
 *
 * TAKROR MAHSULOT YARATMASLIK: qidiruv natijasi bo'sh bo'lgandagina "yangi
 * mahsulot" taklif qilinadi va u kiritilgan nom bilan ochiladi — shu bois
 * foydalanuvchi mavjud tovarni ko'rmay turib nusxasini yaratib yubormaydi.
 */
export function MahsulotQidiruv({
  onTanla,
  onYangi,
  tanlanganIdlar = [],
}: {
  onTanla: (m: OmborMahsulotDTO) => void;
  onYangi: (nomi: string) => void;
  /** Allaqachon ro'yxatga qo'shilganlar — ikkinchi marta tanlanmasin. */
  tanlanganIdlar?: string[];
}) {
  const [q, setQ] = useState("");
  const [natijalar, setNatijalar] = useState<OmborMahsulotDTO[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const sorovNo = useRef(0);

  useEffect(() => {
    const no = ++sorovNo.current;
    setYuklanmoqda(true);
    const t = setTimeout(async () => {
      try {
        const sp = new URLSearchParams({ limit: "20", sahifa: "1" });
        if (q.trim()) sp.set("q", q.trim());
        const res = await fetch(`/api/ombor/mahsulotlar?${sp}`);
        const data = await res.json().catch(() => ({ mahsulotlar: [] }));
        // Kech kelgan javob yangisini bosib ketmasin.
        if (no === sorovNo.current) setNatijalar(data.mahsulotlar ?? []);
      } finally {
        if (no === sorovNo.current) setYuklanmoqda(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const korinadigan = natijalar.filter((m) => !tanlanganIdlar.includes(m.id));

  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Mahsulotni qidiring..."
        className={INPUT_CLASS}
        autoFocus
      />

      <div className="max-h-64 overflow-y-auto rounded-xl border border-line divide-y divide-line">
        {korinadigan.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onTanla(m)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2 transition"
          >
            <span className="w-9 h-9 shrink-0 rounded-lg bg-surface-2 overflow-hidden flex items-center justify-center">
              {m.rasmUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.rasmUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm text-faint" aria-hidden>
                  &#128230;
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-fg truncate">{m.nomi}</span>
              <span className="block text-2xs text-muted tnum">
                Qoldiq: {formatSom(m.miqdor)} {m.birlik}
              </span>
            </span>
          </button>
        ))}

        {korinadigan.length === 0 && (
          <p className="px-3 py-4 text-sm text-center text-faint">
            {yuklanmoqda ? "Qidirilmoqda..." : "Topilmadi"}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onYangi(q.trim())}
        className="w-full text-sm text-brand font-medium py-2 rounded-lg hover:bg-brand-wash transition"
      >
        + Yangi mahsulot{q.trim() ? `: "${q.trim()}"` : ""}
      </button>
    </div>
  );
}
