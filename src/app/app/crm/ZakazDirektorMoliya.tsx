"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { formatMoney, parseSomInput } from "@/lib/format";
import {
  kirimUlushi,
  qarzUlushi,
  ZAKAZ_HOLATLARI,
  ZAKAZ_HOLAT_NOMI,
  type ZakazHolat,
} from "@/lib/crm/pipeline";
import {
  TolovMaydonlari,
  qatorlarniTozala,
  tolovlarXatosi,
  type TolovQatori,
} from "./TolovMaydonlari";
import { serverdanYangi } from "./BuyurtmaTahrir";
import type { BuyurtmaDTO, KategoriyaDTO } from "./turlar";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * DIREKTOR — MOLIYAGA O'TGAN ZAKAZNING NARXI, TO'LOVI VA HOLATI.
 *
 * ═══ NEGA ALOHIDA, OGOHLANTIRISH BILAN ═══
 * Saqlash oddiy tahrir EMAS: server eski kirimlarni YUMSHOQ o'chiradi,
 * qarzni BEKOR qiladi va yangi raqamlardan moliyani QAYTA yozadi
 * (`lib/crm/direktorTahrir.ts`) — hammasi bitta tranzaksiyada. Shuning
 * uchun natija oldindan ko'rsatiladi (kirimga qancha, qarzdorlikka qancha)
 * va amal alohida, sariq ramkali blokda turadi. Taqsimot brauzerda ham,
 * serverda ham AYNI funksiyalardan (`lib/crm/pipeline.ts`).
 *
 * Qarzga TO'LOV qabul qilingan bo'lsa server rad etadi — pul haqiqatda
 * kelgan, uni jimgina yo'q qilib bo'lmaydi. Xato xabari shu blokda
 * ko'rinadi.
 */

/** Saqlangan zakazdan to'lov qatorlarini tiklaydi (`BuyurtmaTahrir` bilan bir xil). */
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

export function ZakazDirektorMoliya({
  b,
  kategoriyalar,
  onSaqlandi,
}: {
  b: BuyurtmaDTO;
  kategoriyalar: KategoriyaDTO[];
  onSaqlandi: (yangi?: Partial<BuyurtmaDTO>) => void;
}) {
  const [ochiq, setOchiq] = useState(false);
  const [categoryId, setCategoryId] = useState(b.categoryId ?? "");
  const [summa, setSumma] = useState(b.summa > 0 ? String(b.summa) : "");
  const [qatorlar, setQatorlar] = useState<TolovQatori[]>(() => boshlangichQatorlar(b));
  const [qarzga, setQarzga] = useState(b.tolovTuri === "qarz" && b.tolangan === 0);
  const [holat, setHolat] = useState<ZakazHolat>(b.holat as ZakazHolat);
  const [tasdiq, setTasdiq] = useState(false);
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const yangiSumma = summa ? parseSomInput(summa) : 0;
  const satrlar = qatorlarniTozala(qatorlar);
  const yangiTolangan = satrlar.reduce((s, t) => s + t.summa, 0);
  const yangiQarzga = satrlar.length === 0 && qarzga;
  const yangiTolovTuri = yangiQarzga
    ? "qarz"
    : satrlar.length === 1
      ? satrlar[0].kanal
      : satrlar.length > 1
        ? "aralash"
        : null;
  // Yakuniy taqsimot — FAQAT "Yutildi" da yoziladi (boshqa holatda moliya yo'q).
  const kutilganKirim = holat === "YUTILDI" ? kirimUlushi(yangiSumma, yangiTolangan) : 0;
  const kutilganQarz =
    holat === "YUTILDI" ? qarzUlushi(yangiSumma, yangiTolangan, yangiTolovTuri) : 0;

  async function saqlash() {
    const tolovXato = tolovlarXatosi(yangiSumma, satrlar);
    if (tolovXato) {
      setXato(tolovXato);
      setTasdiq(false);
      return;
    }
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summa: yangiSumma,
        tolovlar: satrlar,
        tolovTuri: yangiQarzga ? "qarz" : null,
        holat,
        ...(categoryId ? { categoryId } : {}),
      }),
    });
    setLoading(false);
    const javob = await res.json();
    if (!res.ok) {
      setXato(javob.error ?? "Saqlanmadi");
      setTasdiq(false);
      return;
    }
    setTasdiq(false);
    onSaqlandi(serverdanYangi(javob, kategoriyalar));
  }

  if (!ochiq) {
    return (
      <button
        onClick={() => setOchiq(true)}
        className="w-full rounded-xl border border-dashed border-debt text-sm font-medium py-2 text-debt-fg"
      >
        Narx / to&apos;lov / holatni tuzatish (direktor)
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-debt bg-debt-soft/40 p-3 space-y-2">
      <p className="text-2xs uppercase tracking-wide text-debt-fg">
        Direktor — narx, to&apos;lov va holat
      </p>
      <p className="text-2xs text-muted">
        Saqlashda eski kirim yozuvlari o&apos;chiriladi, qarz bekor qilinadi va moliya YANGI
        raqamlardan qayta yoziladi. Dublikat yozuv paydo bo&apos;lmaydi.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="block text-xs text-muted" htmlFor="zdm-kategoriya">
            Kirim kategoriyasi
          </label>
          <Select
            id="zdm-kategoriya"
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
          <span className="text-xs text-muted">Buyurtma summasi (so&apos;m)</span>
          <input
            value={summa}
            onChange={(e) => setSumma(e.target.value)}
            inputMode="numeric"
            placeholder="750000"
            className={INPUT}
          />
        </label>
      </div>

      <TolovMaydonlari
        qatorlar={qatorlar}
        onQatorlar={setQatorlar}
        narx={yangiSumma}
        qarzga={qarzga}
        onQarzga={setQarzga}
      />

      <div className="space-y-1">
        <label className="block text-xs text-muted" htmlFor="zdm-holat">
          Zakaz holati
        </label>
        <Select
          id="zdm-holat"
          value={holat}
          onChange={(v) => setHolat(v as ZakazHolat)}
          options={ZAKAZ_HOLATLARI.map((h) => ({ value: h, label: ZAKAZ_HOLAT_NOMI[h] }))}
        />
      </div>

      <ul className="text-xs space-y-1 border-l-2 border-line pl-3 tnum">
        <li className={kutilganKirim > 0 ? "text-income font-medium" : "text-faint"}>
          Kirimga: {formatMoney(kutilganKirim)}
        </li>
        <li className={kutilganQarz > 0 ? "text-expense font-medium" : "text-faint"}>
          Qarzdorlikka: {formatMoney(kutilganQarz)}
        </li>
        {holat !== "YUTILDI" && (
          <li className="text-muted">
            Holat &quot;{ZAKAZ_HOLAT_NOMI[holat]}&quot; — moliyaviy yozuv bo&apos;lmaydi.
          </li>
        )}
      </ul>

      {xato && <p className="text-expense text-sm">{xato}</p>}

      {tasdiq ? (
        <div className="flex gap-2">
          <button
            onClick={() => setTasdiq(false)}
            disabled={loading}
            className="flex-1 rounded-lg border border-line text-sm py-2 text-muted"
          >
            Orqaga
          </button>
          <button
            onClick={saqlash}
            disabled={loading}
            className="flex-1 rounded-lg bg-expense text-white text-sm font-medium py-2 disabled:opacity-60"
          >
            {loading ? "Yozilmoqda..." : "Ha, qayta yoz"}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setOchiq(false)}
            className="flex-1 rounded-lg border border-line text-sm py-2 text-muted"
          >
            Yopish
          </button>
          <button
            onClick={() => setTasdiq(true)}
            className="flex-1 rounded-lg border border-line bg-surface text-sm font-medium py-2 text-brand"
          >
            Tuzatishni ko&apos;rish
          </button>
        </div>
      )}
    </div>
  );
}
