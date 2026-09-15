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
 * Nima uchun kerak: CRM'gacha (kategoriya maydoni qo'shilgunga qadar)
 * yaratilgan buyurtmalarda `categoryId` NULL. Ular kirimga o'tkazilsa
 * zaxira kategoriyaga tushadi, ya'ni Kirim hisobotida "Bantik" o'rniga
 * boshqa nom ko'rinadi. Bu yerda sotuvchi to'g'ri kategoriyani tanlab
 * qo'yadi.
 *
 * ═══ TO'LOV BU YERDA EMAS ═══
 * To'lov `ZakazTolovlari` blokiga ko'chirildi va u QO'SHISH amali bo'ldi.
 * Sabab: bu forma to'lov qatorlarini TO'LIQ ALMASHTIRARDI va serverdan
 * kelgan eski suratda ishlagani uchun oldingi to'lovlarni yuvib yuborardi
 * ("50 000 naqd + 250 000 click" dan faqat bittasi qolib ketardi).
 *
 * QULFLAR: kategoriya kirim yozilgach yopiladi (tranzaksiyada kategoriya
 * snapshot), narx esa qarz ochilgunga qadar ochiq — kirim summasi TO'LOV
 * summasi bo'lgani uchun narxni tuzatish yozilgan yozuvni buzmaydi.
 * Narx to'langan puldan kam bo'lolmaydi (server ham tekshiradi).
 */
export function BuyurtmaTahrir({
  b,
  kategoriyalar,
  /** Kirim yozilganmi — kategoriya shunda qulflanadi. */
  kirimBor,
  /** Qarz ochilganmi — narx shunda qulflanadi. */
  qarzBor,
  /** Zakazga haqiqatda tushgan pul — narx bundan kam bo'lolmaydi. */
  tolangan,
  onSaqlandi,
}: {
  b: BuyurtmaDTO;
  kategoriyalar: KategoriyaDTO[];
  kirimBor: boolean;
  qarzBor: boolean;
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
      setXato(`Narx to'langan puldan (${formatMoney(tolangan)}) kam bo'lmasligi kerak`);
      return;
    }
    setLoading(true);
    setXato(null);
    const tana: Record<string, unknown> = {};
    if (!kirimBor) tana.categoryId = categoryId;
    if (!qarzBor) tana.summa = yangiSumma;
    const res = await fetch(`/api/crm/deals/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tana),
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
          <Select
            id="bt-kategoriya"
            value={categoryId}
            onChange={setCategoryId}
            disabled={kirimBor}
            searchable={kategoriyalar.length > 7}
            options={[
              { value: "", label: "Tanlanmagan" },
              ...kategoriyalar.map((k) => ({ value: k.id, label: k.nomi })),
            ]}
          />
          {kirimBor && (
            <p className="text-2xs text-faint">Kirim yozilgan — kategoriya Kirim bo&apos;limidan tuzatiladi.</p>
          )}
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Narx (so&apos;m)</span>
          <input
            value={summa}
            onChange={(e) => setSumma(e.target.value)}
            inputMode="numeric"
            placeholder="500000"
            disabled={qarzBor}
            className={`${INPUT} disabled:opacity-50`}
          />
          {qarzBor && (
            <span className="block text-2xs text-faint">
              Qarz ochilgan — narx Qarzdorlik bo&apos;limidan tuzatiladi.
            </span>
          )}
        </label>
      </div>

      {xato && <p className="text-expense text-sm">{xato}</p>}
      <button
        onClick={saqlash}
        disabled={loading || !ozgardi || (kirimBor && qarzBor)}
        className="w-full rounded-lg border border-line text-sm font-medium py-2 text-brand disabled:opacity-40"
      >
        {loading ? "Saqlanmoqda..." : "Saqlash"}
      </button>
    </div>
  );
}
