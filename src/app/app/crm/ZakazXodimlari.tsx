"use client";

import { useState } from "react";
import type { XodimKategoriyaDTO, ZakazXodimDTO } from "./turlar";

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

/**
 * ZAKAZDAGI XODIMLAR — kategoriya-selektorlar (Sotuvchi, Diktor, Shofer...).
 * Har faol kategoriya uchun bitta selektor; ro'yxatda FAQAT o'sha kategoriya
 * a'zolari (server ham a'zolikni majburlaydi). Hech biri majburiy emas.
 */

/** categoryId → employeeId ("" — tanlanmagan). */
export type ZakazXodimTanlov = Record<string, string>;

/** Tanlovni API kutadigan ro'yxatga aylantiradi (bo'shlari tashlanadi). */
export function tanlovdanRoyxat(t: ZakazXodimTanlov): { categoryId: string; employeeId: string }[] {
  return Object.entries(t)
    .filter(([, employeeId]) => employeeId)
    .map(([categoryId, employeeId]) => ({ categoryId, employeeId }));
}

/**
 * Boshlang'ich tanlov: "sotuvchi" turidagi kategoriyada joriy foydalanuvchining
 * xodim yozuvi bo'lsa — o'zi oldindan tanlanadi (har safar qidirmasin).
 */
export function boshlangichTanlov(kategoriyalar: XodimKategoriyaDTO[], meId: string): ZakazXodimTanlov {
  const t: ZakazXodimTanlov = {};
  for (const k of kategoriyalar) {
    if (k.turi !== "sotuvchi") continue;
    const men = k.azolar.find((a) => a.userId === meId);
    if (men) t[k.id] = men.id;
  }
  return t;
}

/** Mavjud biriktiruvlardan tanlov (tahrirlash oynasi uchun). */
export function biriktiruvdanTanlov(xodimlar: ZakazXodimDTO[]): ZakazXodimTanlov {
  const t: ZakazXodimTanlov = {};
  for (const x of xodimlar) t[x.categoryId] = x.employeeId;
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
      <p className="text-2xs uppercase tracking-wide text-faint">Zakazdagi xodimlar</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {kategoriyalar.map((k) => (
          <label key={k.id} className="block space-y-1">
            <span className="text-xs text-muted">{k.nomi}</span>
            <select
              value={tanlov[k.id] ?? ""}
              onChange={(e) => onChange({ ...tanlov, [k.id]: e.target.value })}
              className={INPUT}
            >
              <option value="">Tanlanmagan</option>
              {k.azolar.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ism}
                </option>
              ))}
            </select>
          </label>
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

  if (kategoriyalar.length === 0 && (!xodimlar || xodimlar.length === 0)) return null;

  async function saqlash() {
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
        <p className="text-2xs uppercase tracking-wide text-faint">Zakazdagi xodimlar</p>
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
      ) : xodimlar === null ? (
        <p className="text-sm text-faint">Yuklanmoqda...</p>
      ) : xodimlar.length === 0 ? (
        <p className="text-sm text-faint">Xodim biriktirilmagan.</p>
      ) : (
        <ul className="space-y-1">
          {xodimlar.map((x) => (
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
