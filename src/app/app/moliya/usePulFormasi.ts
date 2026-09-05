"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { parseSomInput } from "@/lib/format";
import { todayDateOnlyString } from "@/lib/date";
import { shaxsSabablari, sababTop } from "@/lib/moliya/sabablar";
import { kartochkaliMi } from "@/lib/moliya/shaxs";
import type { KategoriyaOption, PulFormasi, TanlanganShaxs } from "./turlar";
import { BOSH_SHAXS } from "./turlar";

/**
 * PUL FORMASI HOLATI — yaratish va tuzatish uchun bitta mantiq.
 *
 * Bu yerda uchta narsa hal qilinadi:
 *  1. tomon almashsa unga MOS bo'lmagan sabab tanlovda qolib ketmasin;
 *  2. qarzga bog'langan sababda tanlangan tomonning joriy qarzi o'qilsin
 *     (10-talab: "To'lovdan keyin" ko'rinishi);
 *  3. summa matndan butun songa aylantirilsin (pul har doim `Int`).
 */
export function boshFormasi(yonalish: "kirim" | "chiqim", kassaId: string): PulFormasi {
  return {
    yonalish,
    shaxs: { ...BOSH_SHAXS, turi: yonalish === "kirim" ? "mijoz" : "taminotchi" },
    sababKod: "",
    categoryId: "",
    summa: "",
    usul: "naqd",
    accountId: kassaId,
    sana: todayDateOnlyString(),
    izoh: "",
  };
}

export function usePulFormasi(boshlangich: PulFormasi, kategoriyalar: KategoriyaOption[]) {
  const [forma, setForma] = useState<PulFormasi>(boshlangich);
  const [qarz, setQarz] = useState<number | null>(null);
  const [qarzYuklanmoqda, setQarzYuklanmoqda] = useState(false);

  const sabablar = useMemo(
    () => shaxsSabablari(forma.yonalish, forma.shaxs.turi),
    [forma.yonalish, forma.shaxs.turi]
  );
  const sabab = forma.sababKod ? sababTop(forma.yonalish, forma.sababKod) : null;
  const qarzgaBogliq = Boolean(sabab?.qarz);
  const summa = parseSomInput(forma.summa);

  const ozgart = useCallback((qism: Partial<PulFormasi>) => {
    setForma((f) => ({ ...f, ...qism }));
  }, []);

  const shaxsniOzgart = useCallback((shaxs: TanlanganShaxs) => {
    setForma((f) => {
      // Tomon turi almashsa unga mos bo'lmagan sabab tanlovda qolmasin.
      const mos = shaxsSabablari(f.yonalish, shaxs.turi).some((s) => s.kod === f.sababKod);
      return { ...f, shaxs, sababKod: mos ? f.sababKod : "" };
    });
  }, []);

  // Tanlangan tomonning JORIY qarzi — faqat qarzga bog'langan sababda.
  useEffect(() => {
    if (!qarzgaBogliq || !forma.shaxs.ism.trim()) {
      setQarz(null);
      return;
    }
    let bekor = false;
    setQarzYuklanmoqda(true);
    const t = setTimeout(async () => {
      try {
        const sp = new URLSearchParams({
          shaxsTuri: forma.shaxs.turi,
          yonalish: forma.yonalish,
          ism: forma.shaxs.ism,
        });
        if (forma.shaxs.turi === "mijoz" && forma.shaxs.id) sp.set("contactId", forma.shaxs.id);
        const res = await fetch(`/api/moliya/qarz?${sp.toString()}`);
        if (!bekor) setQarz(res.ok ? (await res.json()).qarz ?? 0 : 0);
      } catch {
        if (!bekor) setQarz(0);
      } finally {
        if (!bekor) setQarzYuklanmoqda(false);
      }
    }, 250);
    return () => {
      bekor = true;
      clearTimeout(t);
    };
  }, [qarzgaBogliq, forma.shaxs.turi, forma.shaxs.id, forma.shaxs.ism, forma.yonalish]);

  /** Yo'nalishga mos, direktor qo'shgan kategoriyalar (tayyor sabablardan tashqari). */
  const qoshimchaKategoriyalar = useMemo(() => {
    const tayyor = new Set(sabablar.map((s) => s.nomi.toLowerCase()));
    return kategoriyalar.filter(
      (k) => k.turi === forma.yonalish && !tayyor.has(k.nomi.toLowerCase())
    );
  }, [kategoriyalar, sabablar, forma.yonalish]);

  /** Yuborishga tayyormi — tugmani o'chirish uchun. */
  const xato = (() => {
    if (!forma.shaxs.ism.trim()) return "Kimdan/kimga ekanini tanlang";
    if (kartochkaliMi(forma.shaxs.turi) && !forma.shaxs.ism.trim()) return "Tomonni tanlang";
    if (!forma.sababKod && !forma.categoryId) return "Sababni tanlang";
    if (summa <= 0) return "Summani kiriting";
    if (qarzgaBogliq && qarz !== null && summa > qarz) return "Summa qarzdan ko'p";
    return null;
  })();

  return {
    forma,
    setForma,
    ozgart,
    shaxsniOzgart,
    sabablar,
    qoshimchaKategoriyalar,
    qarzgaBogliq,
    qarz,
    qarzYuklanmoqda,
    summa,
    xato,
  };
}
