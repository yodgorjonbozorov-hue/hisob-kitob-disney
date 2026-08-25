"use client";

import { useState } from "react";
import { parseSomInput } from "@/lib/format";
import type { BuyurtmaDTO, KategoriyaDTO } from "./turlar";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * BUYURTMA KATEGORIYASI VA NARXINI TUZATISH.
 *
 * Nima uchun kerak: CRM'gacha (kategoriya maydoni qo'shilgunga qadar)
 * yaratilgan buyurtmalarda `categoryId` NULL. Ular kirimga o'tkazilsa
 * zaxira kategoriyaga tushadi, ya'ni Kirim hisobotida "Bantik" o'rniga
 * boshqa nom ko'rinadi. Bu yerda sotuvchi buyurtmani KIRIMGA
 * O'TKAZISHDAN OLDIN to'g'ri kategoriyani tanlab qo'yadi.
 *
 * Kirim yozilgandan keyin bu blok umuman ko'rsatilmaydi — server ham
 * (api/crm/deals/[id]) o'sha paytdan boshlab summa va kategoriyani
 * qulflaydi, aks holda CRM bir raqamni, Kirim boshqasini ko'rsatardi.
 */
export function BuyurtmaTahrir({
  b,
  kategoriyalar,
  onSaqlandi,
}: {
  b: BuyurtmaDTO;
  kategoriyalar: KategoriyaDTO[];
  onSaqlandi: (yangi: { categoryId: string; kategoriya: string; summa: number }) => void;
}) {
  const [categoryId, setCategoryId] = useState(b.categoryId ?? "");
  const [summa, setSumma] = useState(b.summa > 0 ? String(b.summa) : "");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const yangiSumma = summa ? parseSomInput(summa) : 0;
  const ozgardi = categoryId !== (b.categoryId ?? "") || yangiSumma !== b.summa;

  async function saqlash() {
    if (!categoryId) {
      setXato("Kategoriya tanlansin");
      return;
    }
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, summa: yangiSumma }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Saqlanmadi");
      return;
    }
    onSaqlandi({
      categoryId,
      kategoriya: kategoriyalar.find((k) => k.id === categoryId)?.nomi ?? "",
      summa: yangiSumma,
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2/30 p-3 space-y-2">
      <p className="text-2xs uppercase tracking-wide text-faint">Kategoriya va narx</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted">Kirim kategoriyasi</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={INPUT}>
            <option value="">Tanlanmagan</option>
            {kategoriyalar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nomi}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Narx (so&apos;m)</span>
          <input
            value={summa}
            onChange={(e) => setSumma(e.target.value)}
            inputMode="numeric"
            placeholder="500000"
            className={INPUT}
          />
        </label>
      </div>
      {xato && <p className="text-expense text-sm">{xato}</p>}
      <button
        onClick={saqlash}
        disabled={loading || !ozgardi}
        className="w-full rounded-lg border border-line text-sm font-medium py-2 text-brand disabled:opacity-40"
      >
        {loading ? "Saqlanmoqda..." : "Saqlash"}
      </button>
    </div>
  );
}
