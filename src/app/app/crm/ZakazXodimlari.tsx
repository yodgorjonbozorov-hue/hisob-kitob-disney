"use client";

import { useState } from "react";
import type { XodimKategoriyaDTO, ZakazXodimDTO } from "./turlar";
import { ZakazJamoasiTanlash, biriktiruvdanTanlov, tanlovdanRoyxat, type ZakazXodimTanlov } from "./ZakazJamoasi";

/**
 * Jamoani lavozim bo'yicha guruhlaydi (33-talab): "Videochilar: Sardor,
 * Bekzod". Sotuvchi chiqariladi — u yuqorida alohida qatorda.
 */
export function jamoaGuruhlab(xodimlar: ZakazXodimDTO[]): { nomi: string; ismlar: string[] }[] {
  const guruhlar = new Map<string, { nomi: string; ismlar: string[] }>();
  for (const x of xodimlar) {
    if (x.kategoriyaTuri === "sotuvchi") continue;
    const g = guruhlar.get(x.categoryId) ?? { nomi: x.kategoriyaNomi, ismlar: [] };
    g.ismlar.push(x.isActive ? x.ism : `${x.ism} (nofaol)`);
    guruhlar.set(x.categoryId, g);
  }
  return [...guruhlar.values()];
}

/**
 * TAFSILOT OYNASIDAGI JAMOA BLOKI: lavozim bo'yicha guruhlangan ro'yxat +
 * (huquq bo'lsa va kirim yozilmagan bo'lsa) tahrirlash. Kirim yozilgach
 * server ham qulflaydi — faqat o'qish rejimi qoladi (tarix o'zgarmaydi).
 */
export function ZakazXodimlariBlok({
  dealId,
  kirimBor,
  ozgartira,
  kategoriyalar,
  xodimlar,
  onSaqlandi,
}: {
  dealId: string;
  kirimBor: boolean;
  /** `crm.jamoa` huquqi yoki zakazning o'z mas'uli (37-talab). */
  ozgartira: boolean;
  kategoriyalar: XodimKategoriyaDTO[];
  /** null — hali yuklanmagan. */
  xodimlar: ZakazXodimDTO[] | null;
  onSaqlandi: () => void;
}) {
  const [tahrir, setTahrir] = useState(false);
  const [tanlov, setTanlov] = useState<ZakazXodimTanlov>({});
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  const guruhlar = xodimlar ? jamoaGuruhlab(xodimlar) : null;
  if (kategoriyalar.length === 0 && (!guruhlar || guruhlar.length === 0)) return null;

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
        <p className="text-2xs uppercase tracking-wide text-faint">Zakaz jamoasi</p>
        {!kirimBor && ozgartira && kategoriyalar.length > 0 && !tahrir && (
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
          <ZakazJamoasiTanlash kategoriyalar={kategoriyalar} tanlov={tanlov} onChange={setTanlov} boshidaOchiq />
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
      ) : guruhlar === null ? (
        <p className="text-sm text-faint">Yuklanmoqda...</p>
      ) : guruhlar.length === 0 ? (
        <p className="text-sm text-faint">Jamoa biriktirilmagan.</p>
      ) : (
        <ul className="space-y-1">
          {guruhlar.map((g) => (
            <li key={g.nomi} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-muted shrink-0">{g.nomi}</span>
              <span className="font-medium text-fg text-right">{g.ismlar.join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
