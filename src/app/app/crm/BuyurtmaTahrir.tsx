"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { formatMoney, parseSomInput } from "@/lib/format";
import type { BuyurtmaDTO, KategoriyaDTO } from "./turlar";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * ZAKAZ KATEGORIYASI VA NARXINI TUZATISH.
 *
 * TO'LOV BU YERDA EMAS. To'lovlar alohida ledger bo'limida
 * (`ZakazTolovlari`): har to'lov QO'SHILADI, hech qachon almashtirilmaydi.
 * Ilgari to'lov shu formadan butun ro'yxatni qayta yozish orqali
 * saqlanardi — forma eskirgan snapshot bilan yuborilsa oldingi to'lovlar
 * jimgina o'chib ketardi ("naqd qoldi, click yo'qoldi" muammosi).
 *
 * KATEGORIYA kirim yozilgach QULFLANADI: yozilgan tranzaksiya o'sha
 * kategoriyada turadi va uni CRM'dan surish ikki bo'limni zid holatga
 * tushirardi. NARX esa to'lov kelgandan keyin ham tuzatiladi (zakaz narxi
 * aniqlanishi odatiy hol) — faqat to'langan summadan past bo'la olmaydi va
 * zakaz yakunlangach umuman qulflanadi. Ikkala qoidani ham server
 * mustaqil tekshiradi (`api/crm/deals/[id]`).
 */
export function BuyurtmaTahrir({
  b,
  kategoriyalar,
  /** Kirim yozilgan — kategoriya qulflanadi (server ham rad etadi). */
  kategoriyaQulf,
  /** Zakazga allaqachon kelgan pul — narx bundan past bo'la olmaydi. */
  tolangan,
  onSaqlandi,
}: {
  b: BuyurtmaDTO;
  kategoriyalar: KategoriyaDTO[];
  kategoriyaQulf: boolean;
  tolangan: number;
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
    if (yangiSumma < tolangan) {
      setXato(`Narx to'langan summadan kam bo'lmasligi kerak (to'langan: ${formatMoney(tolangan)})`);
      return;
    }
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summa: yangiSumma,
        // Qulflangan kategoriyani umuman yubormaymiz — server ham rad etadi.
        ...(kategoriyaQulf ? {} : { categoryId }),
      }),
    });
    setLoading(false);
    const javob = await res.json();
    if (!res.ok) {
      setXato(javob.error ?? "Saqlanmadi");
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
        <div className="space-y-1">
          <label className="block text-xs text-muted" htmlFor="bt-kategoriya">Kirim kategoriyasi</label>
          {kategoriyaQulf ? (
            <p className={`${INPUT} text-muted`}>{b.kategoriya ?? "Tanlanmagan"}</p>
          ) : (
            <Select
              id="bt-kategoriya"
              value={categoryId}
              onChange={setCategoryId}
              searchable={kategoriyalar.length > 7}
              options={[
                { value: "", label: "Tanlanmagan" },
                ...kategoriyalar.map((k) => ({ value: k.id, label: k.nomi })),
              ]}
            />
          )}
          {kategoriyaQulf && (
            <p className="text-2xs text-faint">
              Kirim yozilgan — kategoriya Kirim bo&apos;limidan tuzatiladi.
            </p>
          )}
        </div>
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
