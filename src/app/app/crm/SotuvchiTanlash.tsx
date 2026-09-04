"use client";

import { Select } from "@/components/ui/Select";
import type { SotuvchiDTO } from "./turlar";

/**
 * SOTUVCHI SELEKTORI (1/2-talab) — "Zakazni olgan sotuvchi".
 *
 * Ro'yxatda SHU biznesning BARCHA faol sotuvchilari bo'ladi (server
 * tayyorlaydi va o'zi ham majburlaydi) — kim kirgan bo'lsa ham bir xil
 * ro'yxat. Boshlang'ich qiymat — "Tanlanmagan": ishxonada bitta kompyuter
 * va bitta ochiq hisob bo'lgani uchun oldindan tanlangan sotuvchi
 * ko'pincha YOLG'ON bo'lardi. Sotuvni kim qilgan bo'lsa — o'sha tanlanadi.
 *
 * MOBIL (34-talab): mavjud `Select` ishlatiladi — u sig'masa ro'yxatni
 * yuqoriga ochadi va klaviatura chiqqanda formani buzmaydi.
 */
export function SotuvchiTanlash({
  sotuvchilar,
  value,
  onChange,
  majburiy,
  id = "sotuvchi",
}: {
  sotuvchilar: SotuvchiDTO[];
  value: string;
  onChange: (v: string) => void;
  majburiy: boolean;
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

  return (
    <div className="space-y-1">
      <label className="block text-xs text-muted" htmlFor={id}>
        Sotuvchi{majburiy && <span className="text-expense"> *</span>}
      </label>
      <Select
        id={id}
        value={value}
        onChange={onChange}
        searchable={sotuvchilar.length > 7}
        placeholder="Zakazni olgan sotuvchini tanlang"
        options={[
          // "Tanlanmagan" MAJBURIY holatda ham qoladi: u boshlang'ich
          // qiymat, saqlashda esa forma tanlovni talab qiladi.
          { value: "", label: "Tanlanmagan" },
          ...sotuvchilar.map((s) => ({ value: s.id, label: s.ism })),
        ]}
      />
      <p className="text-2xs text-faint">
        Zakazni haqiqatda kim sotgan bo&apos;lsa — o&apos;shani tanlang (kirgan hisob
        bilan bog&apos;liq emas).
      </p>
    </div>
  );
}
