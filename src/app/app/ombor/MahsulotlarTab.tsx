"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { INPUT_CLASS } from "@/components/ui/fieldStyles";
import { MahsulotKarta } from "./MahsulotKarta";
import type {
  OmborKategoriyaDTO,
  OmborMahsulotDTO,
  OmborRoyxatDTO,
} from "@/lib/queries/ombor";
import type { OmborHolati } from "@/lib/validation/taminot";

const FILTRLAR: { kalit: OmborHolati; nomi: string }[] = [
  { kalit: "barchasi", nomi: "Barchasi" },
  { kalit: "kam", nomi: "Kam qolgan" },
  { kalit: "tugagan", nomi: "Tugagan" },
];

/**
 * MAHSULOTLAR TABI — qidiruv, kategoriya chiplari, uchta filtr va rasmli grid.
 *
 * QIDIRUV VA SAHIFALASH SERVERDA: har o'zgarishda `/api/ombor/mahsulotlar`
 * chaqiriladi va faqat ko'rinadigan sahifa keladi. Shu bois 1000+ tovarli
 * do'konda ham sahifa telefonda darhol ochiladi.
 *
 * Grid: telefonda 2 ustun (375px da kartochka ~165px — rasm ham, nom ham
 * o'qiladi), planshetda 3, desktopda 4-5.
 */
export function MahsulotlarTab({
  boshlangich,
  kategoriyalar,
  onTanla,
  onTaminot,
  onYangiMahsulot,
}: {
  boshlangich: OmborRoyxatDTO;
  kategoriyalar: OmborKategoriyaDTO[];
  onTanla: (m: OmborMahsulotDTO) => void;
  onTaminot: () => void;
  onYangiMahsulot: () => void;
}) {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [holat, setHolat] = useState<OmborHolati>("barchasi");
  const [royxat, setRoyxat] = useState<OmborRoyxatDTO>(boshlangich);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const sorovNo = useRef(0);
  // Birinchi renderda serverdan kelgan ro'yxat allaqachon bor — uni darhol
  // qayta so'rash ortiqcha so'rov bo'lardi.
  const birinchi = useRef(true);

  const yukla = useCallback(
    async (sahifa: number, qoshib: boolean) => {
      const no = ++sorovNo.current;
      setYuklanmoqda(true);
      try {
        const sp = new URLSearchParams({ sahifa: String(sahifa), limit: "24", holat });
        if (q.trim()) sp.set("q", q.trim());
        if (categoryId) sp.set("categoryId", categoryId);
        const res = await fetch(`/api/ombor/mahsulotlar?${sp}`);
        const data: OmborRoyxatDTO = await res.json();
        if (no !== sorovNo.current) return; // kech kelgan javob
        setRoyxat((prev) =>
          qoshib ? { ...data, mahsulotlar: [...prev.mahsulotlar, ...data.mahsulotlar] } : data
        );
      } finally {
        if (no === sorovNo.current) setYuklanmoqda(false);
      }
    },
    [q, categoryId, holat]
  );

  useEffect(() => {
    if (birinchi.current) {
      birinchi.current = false;
      return;
    }
    const t = setTimeout(() => void yukla(1, false), 250);
    return () => clearTimeout(t);
  }, [yukla]);

  const bosh = royxat.mahsulotlar.length === 0;
  const filtrlanganmi = Boolean(q.trim()) || categoryId !== null || holat !== "barchasi";

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Mahsulot qidirish..."
        className={INPUT_CLASS}
        aria-label="Mahsulot qidirish"
      />

      {kategoriyalar.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          <Chip faol={categoryId === null} onClick={() => setCategoryId(null)}>
            Barchasi
          </Chip>
          {kategoriyalar.map((k) => (
            <Chip key={k.id} faol={categoryId === k.id} onClick={() => setCategoryId(k.id)}>
              {k.nomi}
            </Chip>
          ))}
        </div>
      )}

      {/* Son SKROLL QATORIDAN TASHQARIDA: ichida bo'lsa 375px ekranda
          chipslar bilan birga surilib, qirqilib ko'rinardi ("120..."). */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 min-w-0">
          {FILTRLAR.map((f) => (
            <Chip key={f.kalit} faol={holat === f.kalit} onClick={() => setHolat(f.kalit)}>
              {f.nomi}
            </Chip>
          ))}
        </div>
        <span className="shrink-0 text-2xs text-muted tnum">{royxat.jami} ta</span>
      </div>

      {bosh ? (
        filtrlanganmi ? (
          <EmptyState
            icon="🔍"
            title="Topilmadi"
            description="Boshqa nom yozing yoki filtrni tozalang."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQ("");
                  setCategoryId(null);
                  setHolat("barchasi");
                }}
              >
                Filtrni tozalash
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="📦"
            title="Omboringiz hali bo'sh"
            description="Birinchi mahsulot yoki kelgan tovarni kiriting. Tovar kelganda qoldiq avtomatik oshadi."
            action={
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={onTaminot}>+ Omborga ta&apos;minot</Button>
                <Button variant="secondary" onClick={onYangiMahsulot}>
                  + Yangi mahsulot
                </Button>
              </div>
            }
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
            {royxat.mahsulotlar.map((m) => (
              <MahsulotKarta key={m.id} m={m} onClick={() => onTanla(m)} />
            ))}
          </div>

          {royxat.yanaBor && (
            <div className="flex justify-center pt-1">
              <Button
                variant="secondary"
                loading={yuklanmoqda}
                onClick={() => void yukla(royxat.sahifa + 1, true)}
              >
                Yana yuklash
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Chip({
  faol,
  onClick,
  children,
}: {
  faol: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 snap-start px-3.5 py-1.5 rounded-full text-sm font-medium transition min-h-[36px] border ${
        faol
          ? "bg-brand text-brand-fg border-brand"
          : "bg-surface text-muted border-line hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
