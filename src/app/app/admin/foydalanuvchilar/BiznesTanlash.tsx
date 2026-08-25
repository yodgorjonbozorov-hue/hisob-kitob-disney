"use client";

import type { BusinessOption } from "./turlar";

/**
 * "QAYSI BIZNESDA ISHLAYDI" — ko'p tanlovli ro'yxat.
 *
 * Bir jamoa bir nechta biznesni yuritishi mumkin (masalan gullar va sovg'a
 * qutilari — sotuvchilar bir xil, bizneslar esa hisob-kitob chalkashmasligi
 * uchun alohida). Shu bois xodimga bir nechta biznes belgilanadi.
 *
 * Kassir uchun kamida bitta biznes shart (server ham tekshiradi); sotuvchi
 * uchun bo'sh qoldirish mumkin — u holda barcha bizneslarni ko'radi.
 *
 * RO'YXATDA FAQAT shu kompaniyaning bizneslari bo'ladi (sahifa tenant-scoped
 * so'rov bilan yuklaydi), server esa yuborilgan har id'ni QAYTA tekshiradi —
 * frontend ro'yxati himoya emas.
 */
export function BiznesTanlash({
  businesses,
  tanlangan,
  onChange,
  kassir,
  disabled,
}: {
  businesses: BusinessOption[];
  tanlangan: string[];
  onChange: (idlar: string[]) => void;
  /** Kassirda "barcha bizneslar" varianti yo'q — kamida bitta tanlanadi. */
  kassir: boolean;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    const yangi = tanlangan.includes(id) ? tanlangan.filter((x) => x !== id) : [...tanlangan, id];
    if (kassir && yangi.length === 0) return;
    onChange(yangi);
  }

  return (
    <div className="space-y-1.5 max-h-56 overflow-y-auto">
      {businesses.map((b) => (
        <label
          key={b.id}
          className="flex items-center gap-2.5 rounded-lg border border-line px-3 min-h-[44px] text-sm cursor-pointer hover:bg-surface-2"
        >
          <input
            type="checkbox"
            checked={tanlangan.includes(b.id)}
            onChange={() => toggle(b.id)}
            disabled={disabled}
            className="accent-brand w-4 h-4"
          />
          <span className="truncate">{b.nomi}</span>
        </label>
      ))}
      {businesses.length === 0 && <p className="text-xs text-faint">Biznes yo&apos;q.</p>}
      {!kassir && tanlangan.length === 0 && (
        <p className="text-2xs text-faint">
          Hech biri belgilanmasa — xodim BARCHA bizneslarni ko&apos;radi.
        </p>
      )}
    </div>
  );
}
