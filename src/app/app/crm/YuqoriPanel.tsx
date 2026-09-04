"use client";

import { useCallback, useState } from "react";
import { XodimKassaKartasi } from "./XodimKassaKartasi";
import { ChiqimKartasi } from "./ChiqimKartasi";
import type { ChiqimTanlov } from "./ChiqimModal";
import type { CrmYuqoriPanelDTO } from "@/lib/crm/yuqoriPanel";

/**
 * BUYURTMALAR SAHIFASINING YUQORI PANELI — ikki karta yonma-yon
 * (telefonda bir-birining tagida).
 *
 * Chiqim saqlangan yoki kassa topshirilgan zahoti IKKALA karta ham
 * yangilanadi: raqamlar bitta server so'rovidan keladi (`/api/crm/panel`),
 * shuning uchun ular hech qachon ajralib qolmaydi va sahifani qayta
 * yuklash shart emas. So'rov muvaffaqiyatsiz bo'lsa eski raqamlar joyida
 * qoladi — yozuv baribir bazaga tushgan, uni yolg'on 0 bilan almashtirmaymiz.
 */
export function YuqoriPanel({
  boshlangich,
  kategoriyalar,
  kassalar,
  bugun,
}: {
  boshlangich: CrmYuqoriPanelDTO;
  /** Chiqim turidagi faol kategoriyalar (modal uchun). */
  kategoriyalar: ChiqimTanlov[];
  /** Faol kassalar — nomlar, summasiz. */
  kassalar: ChiqimTanlov[];
  bugun: string;
}) {
  const [panel, setPanel] = useState(boshlangich);

  const yangila = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/panel", { cache: "no-store" });
      if (!res.ok) return;
      setPanel((await res.json()) as CrmYuqoriPanelDTO);
    } catch {
      // Tarmoq xatosi — kartalar eski raqam bilan qoladi (yuqoridagi izoh).
    }
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
      <XodimKassaKartasi kassa={panel.kassa} onYangilandi={yangila} />
      <ChiqimKartasi
        chiqim={panel.chiqim}
        kategoriyalar={kategoriyalar}
        kassalar={kassalar}
        bugun={bugun}
        onYangilandi={yangila}
      />
    </div>
  );
}
