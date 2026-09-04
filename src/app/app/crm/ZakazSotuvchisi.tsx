"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { SotuvchiDTO, ZakazSotuvchiDTO } from "./turlar";

/**
 * ZAKAZ TAFSILOTIDAGI SOTUVCHI (10-talab): joriy sotuvchi + "O'zgartirish".
 *
 * O'zgartirish CRM'ga kira olgan HAR BIR xodimga ochiq: bitta kompyuterda
 * ochiq turgan hisob sotuvchini aniqlamaydi, shuning uchun noto'g'ri
 * yozilgan sotuvchini tuzatish kundalik amal (server ham shu qoidada).
 *
 * O'zgartirish serverda ATOMIK bajariladi va audit jurnaliga yoziladi
 * (kim edi → kimga o'tdi → kim o'zgartirdi → qachon), shuning uchun bu yerda
 * qo'shimcha jurnal yozilmaydi.
 *
 * Nofaol xodim tarixda saqlanadi (30-talab): u ro'yxatda chiqmasa ham
 * zakazdagi nomi ko'rinib turadi.
 */
export function ZakazSotuvchisiBlok({
  dealId,
  sotuvchi,
  sotuvchilar,
  onSaqlandi,
}: {
  dealId: string;
  /** null — hali yuklanmagan yoki biriktirilmagan. */
  sotuvchi: ZakazSotuvchiDTO | null;
  sotuvchilar: SotuvchiDTO[];
  onSaqlandi: () => void;
}) {
  const [tahrir, setTahrir] = useState(false);
  const [tanlov, setTanlov] = useState("");
  const [loading, setLoading] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function saqlash() {
    if (!tanlov) return;
    setLoading(true);
    setXato(null);
    const res = await fetch(`/api/crm/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sotuvchiId: tanlov }),
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs uppercase tracking-wide text-faint">Zakazni olgan sotuvchi</p>
        {sotuvchilar.length > 0 && !tahrir && (
          <button
            onClick={() => {
              setTanlov(sotuvchi?.employeeId ?? "");
              setTahrir(true);
            }}
            className="text-brand text-xs font-medium"
          >
            O&apos;zgartirish
          </button>
        )}
      </div>

      {tahrir ? (
        <div className="space-y-2">
          <Select
            value={tanlov}
            onChange={setTanlov}
            searchable={sotuvchilar.length > 7}
            aria-label="Sotuvchi"
            placeholder="Sotuvchini tanlang"
            options={sotuvchilar.map((s) => ({ value: s.id, label: s.ism }))}
          />
          {xato && <p className="text-expense text-sm">{xato}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setTahrir(false)}
              className="px-3 py-1.5 rounded-lg border border-line text-xs text-muted"
            >
              Bekor
            </button>
            <button
              onClick={saqlash}
              disabled={loading || !tanlov}
              className="px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-medium disabled:opacity-60"
            >
              {loading ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </div>
      ) : sotuvchi ? (
        <p className="text-sm font-medium text-fg">
          {sotuvchi.ism}
          {!sotuvchi.isActive && <span className="text-2xs text-faint"> · nofaol</span>}
        </p>
      ) : (
        <p className="text-sm text-faint">Sotuvchi biriktirilmagan.</p>
      )}
    </div>
  );
}
