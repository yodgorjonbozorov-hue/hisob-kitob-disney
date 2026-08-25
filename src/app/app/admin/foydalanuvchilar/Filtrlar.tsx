"use client";

import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { rolVariantlari, type BusinessOption, type MaxsusRol } from "./turlar";
import type { Filtr, Holat } from "./useXodimlar";

/**
 * QIDIRUV VA FILTRLAR.
 *
 * Asosiy uchta narsa doim ko'rinadi: qidiruv, holat va "+ Yangi xodim".
 * Rol va biznes — QO'SHIMCHA filtrlar: ular kamdan-kam kerak, shuning uchun
 * ikkinchi qatorda va sukut bo'yicha "Barchasi" holatida turadi. Ekranni
 * filtrlar bilan to'ldirib tashlash ro'yxatning o'zini ko'rinmas qiladi.
 */
export function Filtrlar({
  filtr,
  setFiltr,
  businesses,
  maxsusRollar,
  onYangi,
}: {
  filtr: Filtr;
  setFiltr: (f: Partial<Filtr>) => void;
  businesses: BusinessOption[];
  maxsusRollar: MaxsusRol[];
  onYangi: () => void;
}) {
  const tanlagich =
    "min-h-[44px] rounded-lg border border-line bg-surface text-fg text-sm px-2.5";

  return (
    <div className="space-y-3">
      {/* Qidiruv va "yangi xodim" BIR QATORDA: telefonda ham ikkalasi
          birinchi ekranda ko'rinadi, sarlavha ostida darhol. */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search
            size={16}
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
          />
          <input
            type="search"
            value={filtr.q}
            onChange={(e) => setFiltr({ q: e.target.value })}
            placeholder="Ism, login yoki rol bo'yicha qidirish..."
            aria-label="Xodimlarni qidirish"
            /* `appearance-none` MAJBURIY: `type="search"` da Chromium o'zining
               `searchfield` ko'rinishini qo'llaydi va `min-height` ni e'tiborsiz
               qoldiradi — maydon 40px bo'lib, barmoq nishoni (44px) dan past
               tushadi. Buni brauzer testi ushladi. */
            className="w-full appearance-none pl-9 pr-3 py-2.5 min-h-[44px] rounded-lg bg-surface-2 border border-line text-fg text-base placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <Button onClick={onYangi} className="shrink-0" aria-label="Yangi foydalanuvchi">
          <Plus size={16} aria-hidden />
          <span className="hidden sm:inline">Yangi foydalanuvchi</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Holat>
          value={filtr.holat}
          onChange={(v) => setFiltr({ holat: v })}
          options={[
            { value: "hammasi", label: "Barchasi" },
            { value: "faol", label: "Faol" },
            { value: "nofaol", label: "Nofaol" },
          ]}
        />

        <select
          value={filtr.rol}
          onChange={(e) => setFiltr({ rol: e.target.value })}
          aria-label="Rol bo'yicha filtr"
          className={tanlagich}
        >
          <option value="">Barcha rollar</option>
          {rolVariantlari(maxsusRollar).map((v) => (
            <option key={v.qiymat} value={v.qiymat}>
              {v.nomi}
            </option>
          ))}
        </select>

        {businesses.length > 1 && (
          <select
            value={filtr.biznes}
            onChange={(e) => setFiltr({ biznes: e.target.value })}
            aria-label="Biznes bo'yicha filtr"
            className={tanlagich}
          >
            <option value="">Barcha bizneslar</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nomi}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
