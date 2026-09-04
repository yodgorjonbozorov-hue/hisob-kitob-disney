"use client";

import { useState } from "react";
import { holatVaqti } from "@/lib/crm/pipeline";
import type { BuyurtmaDTO } from "./turlar";

/** Server javobigacha ko'rsatiladigan mahalliy o'zgarish. */
interface MahalliyOzgarish {
  holat: string;
  sana: string | null;
  /** Ustun ichidagi tartib vaqti (ISO) — "hozir". */
  holatAt: string;
}

/**
 * OPTIMISTIK KO'CHISH — server javobi yetib kelgunicha.
 *
 * `router.refresh()` server javobini kutadi, shuning uchun holat o'zgargach
 * karta bir zumga eski ustunida turib qolardi. Shu bois o'zgarish MAHALLIY
 * ravishda ham yoziladi — zakaz darhol yangi ustunning ENG TEPASIDA paydo
 * bo'ladi (`holatAt` = hozir).
 *
 * Mahalliy nusxa O'Z-O'ZIDAN chiqadi (tozalash effekti kerak emas): server
 * ayni holatni ko'rsatgan yoki undan YANGIROQ o'zgarish yozgan bo'lsa —
 * serverning so'zi oxirgi.
 */
export function useOptimistikKochish(yuklangan: BuyurtmaDTO[]) {
  const [mahalliy, setMahalliy] = useState<Record<string, MahalliyOzgarish>>({});

  const zakazlar = yuklangan.map((b) => {
    const m = mahalliy[b.id];
    if (!m) return b;
    const serverYetdi = m.holat === b.holat && m.sana === b.sana;
    const serverYangiroq = holatVaqti(b) >= Date.parse(m.holatAt);
    if (serverYetdi || serverYangiroq) return b;
    return { ...b, holat: m.holat, sana: m.sana, holatAt: m.holatAt };
  });

  /** Zakazni mahalliy ravishda yangi holatga qo'yadi (tartib vaqti — hozir). */
  function mahalliyYoz(b: BuyurtmaDTO, holat: string, sana: string | null = b.sana) {
    setMahalliy((oldingi) => ({
      ...oldingi,
      [b.id]: { holat, sana, holatAt: new Date().toISOString() },
    }));
  }

  return { zakazlar, mahalliyYoz };
}
