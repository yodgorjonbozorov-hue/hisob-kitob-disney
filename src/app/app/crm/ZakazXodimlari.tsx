"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { XodimKategoriyaDTO, ZakazXodimDTO } from "./turlar";

/**
 * ZAKAZDAGI IJROCHILAR — kategoriya-selektorlar (Diktor, Dekorator, Shofer...).
 * Har faol kategoriya uchun bitta selektor; ro'yxatda FAQAT o'sha kategoriya
 * a'zolari (server ham a'zolikni majburlaydi). Hech biri majburiy emas.
 *
 * SOTUVCHI BU YERDA CHIQMAYDI: u alohida birinchi darajali maydonga ko'chdi
 * (`SotuvchiTanlash`) — "zakazni kim oldi" va "zakazni kim bajaradi" ikki
 * boshqa savol (38-talab), ikkita joyda so'ralsa qarama-qarshi javob paydo
 * bo'lardi.
 */

/** Ijrochi kategoriyalari — sotuvchi turidagilar chiqarib tashlanadi. */
export function ijroKategoriyalari(kategoriyalar: XodimKategoriyaDTO[]): XodimKategoriyaDTO[] {
  return kategoriyalar.filter((k) => k.turi !== "sotuvchi");
}


/** categoryId → employeeId ("" — tanlanmagan). */
export type ZakazXodimTanlov = Record<string, string>;

/** Tanlovni API kutadigan ro'yxatga aylantiradi (bo'shlari tashlanadi). */
export function tanlovdanRoyxat(t: ZakazXodimTanlov): { categoryId: string; employeeId: string }[] {
  return Object.entries(t)
    .filter(([, employeeId]) => employeeId)
    .map(([categoryId, employeeId]) => ({ categoryId, employeeId }));
}

/**
 * Mavjud biriktiruvlardan tanlov (tahrirlash oynasi uchun). Sotuvchi
 * qatorlari chiqariladi — u alohida maydondan boshqariladi.
 */
export function biriktiruvdanTanlov(xodimlar: ZakazXodimDTO[]): ZakazXodimTanlov {
  const t: ZakazXodimTanlov = {};
  for (const x of xodimlar) {
    if (x.kategoriyaTuri === "sotuvchi") continue;
    t[x.categoryId] = x.employeeId;
  }
  return t;
}

export function ZakazXodimlariTanlash({
  kategoriyalar,
  tanlov,
  onChange,
}: {
  kategoriyalar: XodimKategoriyaDTO[];
  tanlov: ZakazXodimTanlov;
  onChange: (t: ZakazXodimTanlov) => void;
}) {
  if (kategoriyalar.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-2xs uppercase tracking-wide text-faint">Zakazni bajaruvchilar</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {kategoriyalar.map((k) => (
          <div key={k.id} className="space-y-1">
            <label className="block text-xs text-muted" htmlFor={`zakaz-xodim-${k.id}`}>
              {k.nomi}
            </label>
            <Select
              id={`zakaz-xodim-${k.id}`}
              value={tanlov[k.id] ?? ""}
              onChange={(v) => onChange({ ...tanlov, [k.id]: v })}
              searchable={k.azolar.length > 7}
              options={[
                { value: "", label: "Tanlanmagan" },
                ...k.azolar.map((a) => ({ value: a.id, label: a.ism })),
              ]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Tafsilot oynasidagi blok: joriy biriktiruvlar ro'yxati + (kirim yozilmagan
 * bo'lsa) tahrirlash. Kirim yozilgach server ham qulflaydi — bu yerda faqat
 * o'qish rejimi qoladi (tarixiy biriktiruv o'zgarmaydi).
 */
export function ZakazXodimlariBlok({
  dealId,
  kirimBor,
  kategoriyalar,
  xodimlar,
  onSaqlandi,
}: {
  dealId: string;
  kirimBor: boolean;
  kategoriyalar: XodimKategoriyaDTO[];
  /** null — hali yuklanmagan. */
  xodimlar: ZakazXodimDTO[] | null;
  onSaqlandi: () => void;
}) {
  const [tahrir, setTahrir] = useState(false);
  const [tanlov, setTanlov] = useState<ZakazXodimTanlov>({});
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  // Sotuvchi bu blokda ko'rsatilmaydi — u yuqorida alohida qatorda.
  const ijrochilar = xodimlar?.filter((x) => x.kategoriyaTuri !== "sotuvchi") ?? null;
  if (kategoriyalar.length === 0 && (!ijrochilar || ijrochilar.length === 0)) return null;

  async function saqlash() {
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Faqat IJROCHILAR yuboriladi: server sotuvchi biriktiruvini alohida
      // yo'ldan boshqaradi, shuning uchun u bu ro'yxatda tegilmaydi.
      body: JSON.stringify({ xodimlar: tanlovdanRoyxat(tanlov) }),
    });
    setLoading(false);
    if (!res.ok) {
      setXato((await res.json()).error ?? "Saqlanmadi");
      return;
    }
    setTahrir(false);
    onSaqlandi();
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-2xs uppercase tracking-wide text-faint">Zakazni bajaruvchilar</p>
        {!kirimBor && kategoriyalar.length > 0 && !tahrir && (
          <button
            onClick={() => {
              setTanlov(biriktiruvdanTanlov(xodimlar ?? []));
              setTahrir(true);
            }}
            className="text-brand text-xs font-medium"
          >
            Tahrirlash
          </button>
        )}
      </div>

      {tahrir ? (
        <div className="space-y-2">
          <ZakazXodimlariTanlash kategoriyalar={kategoriyalar} tanlov={tanlov} onChange={setTanlov} />
          {xato && <p className="text-expense text-sm">{xato}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setTahrir(false)} className="px-3 py-1.5 rounded-lg border border-line text-xs text-muted">
              Bekor
            </button>
            <button
              onClick={saqlash}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-medium disabled:opacity-60"
            >
              {loading ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      ) : ijrochilar === null ? (
        <p className="text-sm text-faint">Yuklanmoqda...</p>
      ) : ijrochilar.length === 0 ? (
        <p className="text-sm text-faint">Bajaruvchi biriktirilmagan.</p>
      ) : (
        <ul className="space-y-1">
          {ijrochilar.map((x) => (
            <li key={x.id} className="flex items-center justify-between text-sm">
              <span className="text-muted">{x.kategoriyaNomi}</span>
              <span className="font-medium text-fg">{x.ism}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
