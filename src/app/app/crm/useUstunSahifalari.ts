"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BuyurtmaDTO, UstunSahifaDTO } from "./turlar";

/**
 * DOSKA USTUNLARINING SAHIFALARI — "Yana ko'rsatish" holati.
 *
 * NEGA ALOHIDA HOOK: doska komponentida allaqachon sudrab tashlash,
 * optimistik ko'chirish va oynalar bor; sahifalash mantig'i u yerga
 * sig'maydi (komponent 250 satrdan oshmasin — loyiha qoidasi).
 *
 * QOIDA: server so'zi oxirgi. Serverdan yangi propa kelganda (masalan
 * `router.refresh()` yoki filtr o'zgarishi) holat QAYTA BOSHLANADI —
 * "Yana ko'rsatish" bilan yig'ilgan qo'shimcha sahifalar tozalanadi, aks
 * holda doskada eskirgan zakaz osilib qolardi.
 */
export function useUstunSahifalari(sahifalar: UstunSahifaDTO[], filtr: Record<string, string>) {
  const [holat, setHolat] = useState<Record<string, UstunSahifaDTO>>(() =>
    Object.fromEntries(sahifalar.map((s) => [s.ustun, s]))
  );
  const [yuklanayotgan, setYuklanayotgan] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    setHolat(Object.fromEntries(sahifalar.map((s) => [s.ustun, s])));
  }, [sahifalar]);

  /** Yuklangan barcha zakazlar (ustunlar bo'ylab) — tanlash va qidirish uchun. */
  const zakazlar: BuyurtmaDTO[] = useMemo(
    () => Object.values(holat).flatMap((s) => s.zakazlar),
    [holat]
  );

  /** Keyingi 10 tasi — SERVERDAN, kursor bilan (brauzerda kesish yo'q). */
  const yanaKorsatish = useCallback(
    async (ustun: string) => {
      const hozir = holat[ustun];
      if (!hozir?.kursor) return;
      setYuklanayotgan(ustun);
      setXato(null);
      const p = new URLSearchParams({ ustun, kursor: hozir.kursor });
      for (const [k, v] of Object.entries(filtr)) if (v) p.set(k, v);
      const res = await fetch(`/api/crm/board?${p.toString()}`);
      setYuklanayotgan(null);
      if (!res.ok) {
        setXato((await res.json()).error ?? "Yuklanmadi");
        return;
      }
      const sahifa: UstunSahifaDTO = await res.json();
      setHolat((oldingi) => {
        const oldingiUstun = oldingi[ustun];
        if (!oldingiUstun) return oldingi;
        // Takror kelgan zakaz qo'shilmaydi (kursor chetlab o'tgan holat).
        const bor = new Set(oldingiUstun.zakazlar.map((z) => z.id));
        const yangilar = sahifa.zakazlar.filter((z) => !bor.has(z.id));
        return {
          ...oldingi,
          [ustun]: {
            ...oldingiUstun,
            zakazlar: [...oldingiUstun.zakazlar, ...yangilar],
            kursor: sahifa.kursor,
          },
        };
      });
    },
    [holat, filtr]
  );

  return { holat, zakazlar, yuklanayotgan, yanaKorsatish, sahifaXatosi: xato };
}
