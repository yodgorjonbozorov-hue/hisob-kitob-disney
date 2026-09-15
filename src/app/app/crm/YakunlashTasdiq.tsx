"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import { TOLOV_HOLAT_NOMI, tolovHolati, yutildiTekshiruvi } from "@/lib/crm/pipeline";
import type { BuyurtmaDTO, ZakazTolovHisobiDTO } from "./turlar";

/**
 * ZAKAZNI YAKUNLASH TASDIG'I.
 *
 * ═══ TO'LIQ TO'LANMAGAN ZAKAZ YUTILDIGA O'TMAYDI ═══
 * Oyna avval SERVERDAN to'lov hisobini oladi (doskadagi eskirgan snapshotga
 * ishonmaydi) va qoldiq qolgan bo'lsa tugmani BLOKLAYDI:
 *
 *   "Zakaz to'liq to'lanmagan. Qoldiq: 1 200 000 so'm."
 *
 * Bu faqat qulaylik: haqiqiy himoya serverda (`lib/crm/yakunlash.ts`) —
 * brauzerdagi tugmani o'chirish himoya emas.
 *
 * ═══ QARZGA YOPISH — ANIQ TANLOV ═══
 * Nasiya savdoda qoldiq qarzdorlikka yozilishi mumkin, lekin buni
 * foydalanuvchi ATAYLAB belgilaydi (belgi sukut bo'yicha O'CHIQ). Belgisiz
 * hech qanday qarz yaratilmaydi: zalog berilganining o'zi qarz emas.
 */
export function YakunlashTasdiq({
  b,
  onClose,
  onDone,
}: {
  b: BuyurtmaDTO;
  onClose: () => void;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [hisob, setHisob] = useState<ZakazTolovHisobiDTO | null>(null);
  const [qarzga, setQarzga] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  // TO'LOV HISOBI SERVERDAN: pul yozadigan amal oldidan raqam eskirgan
  // bo'lishi mumkin emas (boshqa oynada to'lov qo'shilgan bo'lishi mumkin).
  useEffect(() => {
    let bekor = false;
    void (async () => {
      const res = await fetch(`/api/crm/deals/${b.id}/tolov`);
      if (!res.ok || bekor) return;
      setHisob((await res.json()) as ZakazTolovHisobiDTO);
    })();
    return () => {
      bekor = true;
    };
  }, [b.id]);

  const summa = hisob?.summa ?? b.summa;
  const tolangan = hisob?.tolangan ?? b.tolangan;
  const qoldiq = Math.max(0, summa - tolangan);
  const holat = tolovHolati(summa, tolangan, b.tolovTuri);
  // Brauzer va server AYNI funksiyadan javob oladi — ko'rsatilgan shart
  // yozilgan shart bilan bir xil (`lib/crm/pipeline.ts`).
  const tekshiruv = yutildiTekshiruvi(summa, tolangan, b.tolovTuri, qarzga);
  const yuklandi = hisob !== null;

  async function yakunlash() {
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holat: "YUTILDI", qarzgaYopish: qarzga }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Yakunlanmadi");
      return;
    }
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-line p-5 space-y-3"
      >
        <h3 className="font-semibold text-fg">Zakazni yutildi qilish</h3>
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{b.nomi}</span> —{" "}
          <span className="tnum">{formatMoney(summa)}</span> ({TOLOV_HOLAT_NOMI[holat].toLowerCase()})
        </p>

        <ul className="text-xs space-y-1 border-l-2 border-line pl-3 tnum">
          <li className="text-muted">
            Jami: <span className="text-fg font-medium">{formatMoney(summa)}</span>
          </li>
          <li className={tolangan > 0 ? "text-income font-medium" : "text-faint"}>
            To&apos;langan: {formatMoney(tolangan)}
          </li>
          <li className={qoldiq > 0 ? "text-debt-fg font-medium" : "text-muted"}>
            Qoldiq: {formatMoney(qoldiq)}
          </li>
          <li className="text-muted">Kategoriya: {b.kategoriya ?? "Sotuv"}</li>
          {b.sana && <li className="text-muted">Zakaz sanasi: {b.sana}</li>}
        </ul>

        <p className="text-2xs text-faint">
          Pul to&apos;lov qilingan paytda Kirimga tushgan — &quot;Yutildi&quot; yangi kirim
          yaratmaydi (dublikat bo&apos;lmaydi).
        </p>

        {summa <= 0 && (
          <p className="text-2xs text-debt-fg">
            Narx kiritilmagan — zakaz yutildi bo&apos;ladi, lekin moliyaviy yozuv bo&apos;lmaydi.
          </p>
        )}

        {/* TO'LIQ TO'LANMAGAN: bloklanadi + ANIQ qarz tanlovi taklif qilinadi. */}
        {yuklandi && qoldiq > 0 && summa > 0 && (
          <div className="rounded-lg border border-debt-fg/40 bg-surface-2 p-3 space-y-2">
            <p className="text-xs text-debt-fg font-medium">
              Zakaz to&apos;liq to&apos;lanmagan. Qoldiq: {formatMoney(qoldiq)} so&apos;m.
            </p>
            <p className="text-2xs text-muted">
              Qolgan pul kelgach &quot;To&apos;lovlar&quot; bo&apos;limidan qo&apos;shing — zakaz
              o&apos;shanda yutildi bo&apos;ladi.
            </p>
            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={qarzga}
                onChange={(e) => setQarzga(e.target.checked)}
                className="w-5 h-5 mt-0.5"
              />
              <span>
                Nasiya savdo: qolgan {formatMoney(qoldiq)} qarzdorlikka yozilib yakunlansin
              </span>
            </label>
          </div>
        )}

        {xato && <p className="text-expense text-sm">{xato}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-line text-sm text-muted">
            Bekor
          </button>
          <button
            onClick={yakunlash}
            disabled={loading || !yuklandi || !tekshiruv.mumkin}
            className="px-5 py-2 rounded-lg bg-income text-white text-sm font-medium disabled:opacity-40"
          >
            {loading ? "Yozilmoqda..." : "Ha, yutildi"}
          </button>
        </div>
      </div>
    </div>
  );
}
