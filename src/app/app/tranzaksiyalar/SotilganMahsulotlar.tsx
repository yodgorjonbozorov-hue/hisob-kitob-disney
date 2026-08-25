"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney, formatSom } from "@/lib/format";
import type { SotuvStatistikaDTO } from "@/lib/queries/sotuvStatistika";
import { SotuvKategoriyaGuruhi, birliklarMatni } from "./SotuvKategoriyaGuruhi";
import {
  SOTUV_PRESETLAR,
  oraliqMatni,
  presetOraligi,
  type SanaOraligi,
  type SotuvPreset,
} from "./sotuvSana";

/**
 * "SOTILGAN MAHSULOTLAR" — Kirim bo'limidagi sotuv statistikasi.
 *
 * Ma'lumot QO'LDA KIRITILMAYDI: ombordan sotuv bo'lishi bilanoq `Sale`
 * yozuvi tushadi va bu blok o'sha yozuvlardan shakllanadi
 * (lib/queries/sotuvStatistika.ts). Qaytarilgan sotuv `deletedAt` bilan
 * belgilanadi va shu bois raqamlardan avtomatik ayriladi.
 *
 * Birinchi ko'rinish SERVERDAN keladi (`initial`, "Bugun"), keyingi
 * filtrlar esa /api/sales/statistika orqali — butun sahifa qayta
 * yuklanmaydi va yuqoridagi tranzaksiya ro'yxatiga tegilmaydi.
 */
export function SotilganMahsulotlar({
  bugun,
  initial,
}: {
  /** Server bo'yicha bugungi sana (Toshkent) — presetlar shundan hisoblanadi. */
  bugun: string;
  initial: SotuvStatistikaDTO;
}) {
  const [preset, setPreset] = useState<SotuvPreset>("bugun");
  const [oraliq, setOraliq] = useState<SanaOraligi>({ from: initial.from, to: initial.to });
  const [data, setData] = useState(initial);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);
  const [yopilgan, setYopilgan] = useState<Set<string>>(new Set());
  // Birinchi render serverdan kelgan ma'lumot bilan — qayta so'rov shart emas.
  const birinchi = useRef(true);

  useEffect(() => {
    if (birinchi.current) {
      birinchi.current = false;
      return;
    }
    let bekor = false;
    setYuklanmoqda(true);
    setXato(null);
    fetch(`/api/sales/statistika?from=${oraliq.from}&to=${oraliq.to}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Ma'lumot olinmadi");
        return res.json();
      })
      .then((d: SotuvStatistikaDTO) => {
        if (!bekor) setData(d);
      })
      .catch((e: Error) => {
        if (!bekor) setXato(e.message);
      })
      .finally(() => {
        if (!bekor) setYuklanmoqda(false);
      });
    return () => {
      bekor = true;
    };
  }, [oraliq.from, oraliq.to]);

  function tanla(key: SotuvPreset) {
    setPreset(key);
    // "Sana oralig'i" da mavjud oraliq saqlanadi — foydalanuvchi o'zi tanlaydi.
    if (key !== "oraliq") setOraliq(presetOraligi(key, bugun));
  }

  function sanaOzgardi(patch: Partial<SanaOraligi>) {
    const keyingi = { ...oraliq, ...patch };
    // Teskari oraliq so'ralmasin — server ham uni rad etadi.
    if (keyingi.from > keyingi.to) return;
    setOraliq(keyingi);
  }

  const { yakun } = data;
  const bosh = data.kategoriyalar.length === 0;

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-semibold text-fg">Sotilgan mahsulotlar</h2>
        <span className="text-2xs text-muted tnum">{oraliqMatni(oraliq)}</span>
      </div>

      {/* Sana filtri */}
      <div className="flex flex-wrap gap-2">
        {SOTUV_PRESETLAR.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => tanla(p.key)}
            aria-pressed={preset === p.key}
            className={`px-3 py-1.5 rounded-full text-sm min-h-[36px] border transition ${
              preset === p.key
                ? "bg-brand text-white border-transparent"
                : "bg-surface-2 text-fg border-line hover:border-brand"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "oraliq" && (
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div>
            <label className="block text-xs font-medium text-muted mb-1" htmlFor="sotuv-from">
              Sanadan
            </label>
            <input
              id="sotuv-from"
              type="date"
              value={oraliq.from}
              max={oraliq.to}
              onChange={(e) => e.target.value && sanaOzgardi({ from: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1" htmlFor="sotuv-to">
              Sanagacha
            </label>
            <input
              id="sotuv-to"
              type="date"
              value={oraliq.to}
              min={oraliq.from}
              onChange={(e) => e.target.value && sanaOzgardi({ to: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* IXCHAM YAKUN. Miqdor birliklar bo'yicha alohida: "500 dona + 120 kg"
          ni bitta raqamga qo'shish matematik jihatdan noto'g'ri. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: "Jami sotilgan", qiymat: birliklarMatni(yakun.birliklar), rang: "text-fg" },
          { label: "Mahsulotlar", qiymat: `${formatSom(yakun.mahsulotTurlari)} xil`, rang: "text-fg" },
          { label: "Kategoriyalar", qiymat: `${formatSom(yakun.kategoriyalar)} ta`, rang: "text-fg" },
          { label: "Jami sotuv", qiymat: formatMoney(yakun.jamiSumma), rang: "text-income" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl bg-surface-2 px-3 py-2">
            <p className="text-2xs text-muted">{k.label}</p>
            {/* Uzun summa QIRQILMAYDI, yangi qatorga o'tadi: 360px ekranda
                "12 450 000 soʻm" qirqilsa raqam noto'g'ri o'qilardi. */}
            <p className={`text-sm font-semibold tnum leading-tight break-words ${k.rang}`}>
              {k.qiymat}
            </p>
          </div>
        ))}
      </div>

      {yakun.qaytarilgan.soni > 0 && (
        <p className="text-2xs text-muted tnum">
          ↩ {yakun.qaytarilgan.soni} ta sotuv qaytarilgan ({formatMoney(yakun.qaytarilgan.summa)}) —
          yuqoridagi raqamlardan ayrilgan.
        </p>
      )}

      {xato && <p className="text-sm text-expense">{xato}</p>}

      <div className={`space-y-2 transition-opacity ${yuklanmoqda ? "opacity-50" : ""}`}>
        {bosh ? (
          <EmptyState
            title="Bu davrda sotuv bo'lmagan"
            description="Ombordan mahsulot sotilishi bilan bu ro'yxat o'zi to'ladi."
            icon="🛒"
          />
        ) : (
          data.kategoriyalar.map((g) => {
            const kalit = g.kategoriyaId ?? "";
            return (
              <SotuvKategoriyaGuruhi
                key={kalit}
                guruh={g}
                ochiq={!yopilgan.has(kalit)}
                onToggle={() =>
                  setYopilgan((oldin) => {
                    const keyingi = new Set(oldin);
                    if (keyingi.has(kalit)) keyingi.delete(kalit);
                    else keyingi.add(kalit);
                    return keyingi;
                  })
                }
              />
            );
          })
        )}
      </div>
    </Card>
  );
}
