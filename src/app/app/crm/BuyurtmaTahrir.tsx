"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { parseSomInput } from "@/lib/format";
import {
  TolovMaydonlari,
  qatorlarniTozala,
  tolovlarXatosi,
  type TolovQatori,
} from "./TolovMaydonlari";
import type { BuyurtmaDTO, KategoriyaDTO } from "./turlar";

/**
 * Saqlangan zakazdan TO'LOV QATORLARINI tiklaydi.
 *
 * Aralash to'lovli zakazda qatorlar bazadan keladi. Eski (bir kanalli)
 * zakazda qator yo'q — pul `tolangan`/`tolovTuri` da turadi, shuning uchun
 * u bitta qator qilib ko'rsatiladi va forma ikkala yo'lni bir xil tahrir
 * qiladi. To'lovi belgilanmagan zakaz BO'SH ochiladi: forma uni jimgina
 * qarzga yoki naqdga aylantirib qo'ymaydi.
 */
function boshlangichQatorlar(b: BuyurtmaDTO): TolovQatori[] {
  if (b.tolovlar.length > 0) {
    return b.tolovlar.map((t) => ({ kanal: t.kanal, summa: String(t.summa) }));
  }
  if (b.tolangan > 0) {
    const kanal = b.tolovTuri && b.tolovTuri !== "qarz" ? b.tolovTuri : "naqd";
    return [{ kanal, summa: String(b.tolangan) }];
  }
  return [];
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
    tolovTuri: string | null;
    /** Yutilgan zakazda to'lov belgilanganda server moliyani DARHOL yozadi. */
    transactionId: string | null;
    debtId: string | null;
  }) => void;
}) {
  const [categoryId, setCategoryId] = useState(b.categoryId ?? "");
  const [summa, setSumma] = useState(b.summa > 0 ? String(b.summa) : "");
  const [tolovQatorlari, setTolovQatorlari] = useState<TolovQatori[]>(() => boshlangichQatorlar(b));
  const [qarzga, setQarzga] = useState(b.tolovTuri === "qarz" && b.tolangan === 0);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const yangiSumma = summa ? parseSomInput(summa) : 0;
  const tolovSatrlari = qatorlarniTozala(tolovQatorlari);
  const yangiTolangan = tolovSatrlari.reduce((s, t) => s + t.summa, 0);
  const yangiQarzga = tolovSatrlari.length === 0 && qarzga;
  const ozgardi =
    categoryId !== (b.categoryId ?? "") ||
    yangiSumma !== b.summa ||
    yangiTolangan !== b.tolangan ||
    yangiQarzga !== (b.tolovTuri === "qarz") ||
    JSON.stringify(tolovSatrlari) !== JSON.stringify(qatorlarniTozala(boshlangichQatorlar(b)));

  async function saqlash() {
    if (!categoryId) {
      setXato("Kategoriya tanlansin");
      return;
    }
    const tolovXato = tolovlarXatosi(yangiSumma, tolovSatrlari);
    if (tolovXato) {
      setXato(tolovXato);
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
        tolovlar: tolovSatrlari,
        // QARZGA — faqat to'lovsiz zakazda va faqat foydalanuvchi tanlasa.
        tolovTuri: yangiQarzga ? "qarz" : null,
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
      tolangan: yangiTolangan,
      tolovTuri: yangiQarzga ? "qarz" : tolovSatrlari.length === 1 ? tolovSatrlari[0].kanal : tolovSatrlari.length > 1 ? "aralash" : null,
      transactionId: javob.transactionId ?? b.transactionId,
      debtId: javob.debtId ?? b.debtId,
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
        qatorlar={tolovQatorlari}
        onQatorlar={setTolovQatorlari}
        narx={yangiSumma}
        qarzga={qarzga}
        onQarzga={setQarzga}
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
