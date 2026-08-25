"use client";

import { useMemo, useState } from "react";
import { DetailSheet } from "./DetailSheet";
import { EditModal } from "./EditModal";
import { OchirishTasdiq } from "./OchirishTasdiq";
import type { TransactionDTO } from "@/lib/queries/transactions";
import type { CategoryOption } from "./turlar";

/**
 * YOZUV OYNALARI — tafsilot, tahrirlash va o'chirish tasdig'i.
 *
 * Ular BITTA joyda turadi, chunki sahifada yozuvlar ikki xil ko'rinishda
 * chiqadi (kategoriya kesimi va tekis ro'yxat), lekin qatorga bosilganda
 * ochiladigan oyna ikkalasida ham AYNI bo'lishi kerak. Har ko'rinish
 * o'zining nusxasini yuritganda ikkitasi bir vaqtda ochilib qolishi yoki
 * ular vaqt o'tib bir-biridan farq qilib ketishi muqarrar edi.
 */

export interface OynaHolati {
  batafsil: TransactionDTO | null;
  editing: TransactionDTO | null;
  ochiriladigan: TransactionDTO | null;
}

const BOSH: OynaHolati = { batafsil: null, editing: null, ochiriladigan: null };

export interface YozuvAmallari {
  onBatafsil: (t: TransactionDTO) => void;
  onTahrirlash: (t: TransactionDTO) => void;
  onOchirish: (t: TransactionDTO) => void;
}

/** Holat + qatorlarga uzatiladigan amallar. Bir vaqtda faqat bitta oyna ochiq. */
export function useYozuvOynalari() {
  const [holat, setHolat] = useState<OynaHolati>(BOSH);
  const amallar = useMemo<YozuvAmallari>(
    () => ({
      onBatafsil: (t) => setHolat({ ...BOSH, batafsil: t }),
      onTahrirlash: (t) => setHolat({ ...BOSH, editing: t }),
      onOchirish: (t) => setHolat({ ...BOSH, ochiriladigan: t }),
    }),
    []
  );
  return { holat, setHolat, amallar };
}

export function YozuvOynalari({
  holat,
  setHolat,
  categories,
  ozgartirsaBoladi,
  onUpdated,
  onDelete,
}: {
  holat: OynaHolati;
  setHolat: (h: OynaHolati) => void;
  categories: CategoryOption[];
  /** RBAC oynasi — server har so'rovda egalikni qaytadan tekshiradi. */
  ozgartirsaBoladi: (t: TransactionDTO) => boolean;
  onUpdated: (t: TransactionDTO) => void;
  onDelete: (t: TransactionDTO) => void;
}) {
  const yop = () => setHolat(BOSH);

  return (
    <>
      {holat.batafsil && (
        <DetailSheet
          transaction={holat.batafsil}
          canModify={ozgartirsaBoladi(holat.batafsil)}
          onClose={yop}
          onEdit={() => setHolat({ ...BOSH, editing: holat.batafsil })}
          onDelete={() => setHolat({ ...BOSH, ochiriladigan: holat.batafsil })}
        />
      )}

      {holat.ochiriladigan && (
        <OchirishTasdiq
          transaction={holat.ochiriladigan}
          onClose={yop}
          onConfirm={() => {
            const t = holat.ochiriladigan!;
            yop();
            onDelete(t);
          }}
        />
      )}

      {holat.editing && (
        <EditModal
          transaction={holat.editing}
          categories={categories}
          canDelete={ozgartirsaBoladi(holat.editing)}
          onClose={yop}
          onSaved={(t) => {
            yop();
            onUpdated(t);
          }}
          // Tahrirlash oynasidagi "O'chirish" — tasdiq oynasiga uzatadi,
          // to'g'ridan-to'g'ri o'chirmaydi.
          onDelete={() => setHolat({ ...BOSH, ochiriladigan: holat.editing })}
        />
      )}
    </>
  );
}
