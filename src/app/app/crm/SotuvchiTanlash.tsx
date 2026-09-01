"use client";

import { Select } from "@/components/ui/Select";
import type { SotuvchiDTO } from "./turlar";

/**
 * SOTUVCHI SELEKTORI (1/2-talab) — "Zakazni olgan sotuvchi".
 *
 * Ro'yxatda faqat SHU biznesning faol, sotuvchi kategoriyasiga tayinlangan
 * xodimlari bo'ladi (server tayyorlaydi va o'zi ham majburlaydi).
 *
 * MOBIL (34-talab): mavjud `Select` ishlatiladi — u sig'masa ro'yxatni
 * yuqoriga ochadi va klaviatura chiqqanda formani buzmaydi.
 */
export function SotuvchiTanlash({
  sotuvchilar,
  value,
  onChange,
  majburiy,
  /** Boshqa sotuvchini tanlash huquqi yo'q bo'lsa maydon qulflanadi (5/27-talab). */
  ozgartira,
  id = "sotuvchi",
}: {
  sotuvchilar: SotuvchiDTO[];
  value: string;
  onChange: (v: string) => void;
  majburiy: boolean;
  ozgartira: boolean;
  id?: string;
}) {
  if (sotuvchilar.length === 0) {
    return (
      <div className="space-y-1">
        <p className="block text-xs text-muted">Sotuvchi</p>
        <p className="text-2xs text-faint">
          Sotuvchilar ro&apos;yxati bo&apos;sh. Xodimlar → Kategoriyalar bo&apos;limida
          &quot;Sotuvchi&quot; kategoriyasini yarating va xodimlarni biriktiring.
        </p>
      </div>
    );
  }

  const tanlangan = sotuvchilar.find((s) => s.id === value);

  return (
    <div className="space-y-1">
      <label className="block text-xs text-muted" htmlFor={id}>
        Sotuvchi{majburiy && <span className="text-expense"> *</span>}
      </label>
      {ozgartira ? (
        <Select
          id={id}
          value={value}
          onChange={onChange}
          searchable={sotuvchilar.length > 7}
          placeholder="Zakazni olgan sotuvchini tanlang"
          options={[
            ...(majburiy ? [] : [{ value: "", label: "Tanlanmagan" }]),
            ...sotuvchilar.map((s) => ({ value: s.id, label: s.ism })),
          ]}
        />
      ) : (
        <>
          <p
            id={id}
            className="w-full rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-sm text-fg"
          >
            {tanlangan?.ism ?? "Aniqlanmadi"}
          </p>
          <p className="text-2xs text-faint">
            Zakaz sizning nomingizga yoziladi — boshqa sotuvchini tanlash huquqi yo&apos;q.
          </p>
        </>
      )}
    </div>
  );
}
