"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { parseSomInput } from "@/lib/format";
import { TolovMaydonlari, tolanganHisobla, type PulKanali, type TolovTanlov } from "./TolovMaydonlari";
import type { BuyurtmaDTO, KategoriyaDTO } from "./turlar";

/** Saqlangan `tolangan`/`summa` dan forma tanlovini tiklaydi. */
function boshlangichTanlov(b: BuyurtmaDTO): TolovTanlov {
  if (b.summa > 0 && b.tolangan >= b.summa) return "toliq";
  if (b.tolangan > 0) return "qisman";
  return "qarz";
}

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * ZAKAZ KATEGORIYASI, NARXI VA TO'LOVINI TUZATISH.
 *
 * Nima uchun kerak: CRM'gacha (kategoriya maydoni qo'shilgunga qadar)
 * yaratilgan buyurtmalarda `categoryId` NULL. Ular kirimga o'tkazilsa
 * zaxira kategoriyaga tushadi, ya'ni Kirim hisobotida "Bantik" o'rniga
 * boshqa nom ko'rinadi. Bu yerda sotuvchi buyurtmani KIRIMGA
 * O'TKAZISHDAN OLDIN to'g'ri kategoriyani tanlab qo'yadi.
 *
 * Kirim yoki qarz yozilgandan keyin bu blok umuman ko'rsatilmaydi — server
 * ham (api/crm/deals/[id]) o'sha paytdan boshlab summa, kategoriya va
 * to'lovni qulflaydi, aks holda CRM bir raqamni, Kirim/Qarzdorlik
 * boshqasini ko'rsatardi.
 */
export function BuyurtmaTahrir({
  b,
  kategoriyalar,
  onSaqlandi,
}: {
  b: BuyurtmaDTO;
  kategoriyalar: KategoriyaDTO[];
  onSaqlandi: (yangi: {
    categoryId: string;
    kategoriya: string;
    summa: number;
    tolangan: number;
    tolovTuri: string;
  }) => void;
}) {
  const [categoryId, setCategoryId] = useState(b.categoryId ?? "");
  const [summa, setSumma] = useState(b.summa > 0 ? String(b.summa) : "");
  const [tolovTanlov, setTolovTanlov] = useState<TolovTanlov>(() => boshlangichTanlov(b));
  const [qisman, setQisman] = useState(b.tolangan > 0 ? String(b.tolangan) : "");
  const [kanal, setKanal] = useState<PulKanali>(b.tolovTuri === "click" ? "click" : "naqd");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const yangiSumma = summa ? parseSomInput(summa) : 0;
  const yangiTolangan = tolanganHisobla(tolovTanlov, yangiSumma, qisman ? parseSomInput(qisman) : 0);
  const ozgardi =
    categoryId !== (b.categoryId ?? "") || yangiSumma !== b.summa || yangiTolangan !== b.tolangan;

  async function saqlash() {
    if (!categoryId) {
      setXato("Kategoriya tanlansin");
      return;
    }
    if (yangiTolangan > yangiSumma) {
      setXato("To'langan summa zakaz narxidan ko'p bo'lmasligi kerak");
      return;
    }
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        summa: yangiSumma,
        tolangan: yangiTolangan,
        tolovTuri: tolovTanlov === "qarz" ? "qarz" : kanal,
      }),
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
      tolangan: yangiTolangan,
      tolovTuri: tolovTanlov === "qarz" ? "qarz" : kanal,
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2/30 p-3 space-y-2">
      <p className="text-2xs uppercase tracking-wide text-faint">Kategoriya, narx va to&apos;lov</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="block text-xs text-muted" htmlFor="bt-kategoriya">Kirim kategoriyasi</label>
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
      <TolovMaydonlari
        tanlov={tolovTanlov}
        onTanlov={setTolovTanlov}
        qisman={qisman}
        onQisman={setQisman}
        kanal={kanal}
        onKanal={setKanal}
        narx={yangiSumma}
        tolangan={yangiTolangan}
      />

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
