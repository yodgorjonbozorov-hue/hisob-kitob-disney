"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { XodimDTO } from "@/lib/queries/xodimlar";

/**
 * XODIMLAR RO'YXATI HOLATI — qidiruv, filtr va sahifalash.
 *
 * Filtrlash SERVERDA bajariladi (`/api/users`). Sabab: 500+ xodimli
 * kompaniyada butun ro'yxatni brauzerga yuklab, keyin `.filter()` qilish
 * har harf uchun o'nlab kilobayt DTO degani. Bu yerda faqat "so'rovni
 * yubor va javobni ushla" mantiqi bor.
 *
 * Birinchi ro'yxat SERVERDAN (SSR) keladi — sahifa ochilishi bilan xodimlar
 * ko'rinadi, bo'sh jadval miltillamaydi. So'rov faqat filtr o'zgarganda
 * ketadi.
 */

export type Holat = "hammasi" | "faol" | "nofaol";

export interface Sanoq {
  jami: number;
  faol: number;
  nofaol: number;
  /** Faol boshqaruvchilar (direktor/administrator) soni. */
  boshqaruvchi: number;
  kopBiznes: number;
}

export interface Filtr {
  q: string;
  holat: Holat;
  rol: string;
  biznes: string;
}

const BOSH_FILTR: Filtr = { q: "", holat: "hammasi", rol: "", biznes: "" };

/** Har harf uchun so'rov ketmasin — yozish to'xtaganidan keyin yuboriladi. */
const KUTISH_MS = 300;

export function useXodimlar(boshlangich: {
  items: XodimDTO[];
  total: number;
  sanoq: Sanoq;
  pageSize: number;
}) {
  const [xodimlar, setXodimlar] = useState<XodimDTO[]>(boshlangich.items);
  const [total, setTotal] = useState(boshlangich.total);
  const [sanoq, setSanoq] = useState<Sanoq>(boshlangich.sanoq);
  const [filtr, setFiltrHolati] = useState<Filtr>(BOSH_FILTR);
  const [page, setPage] = useState(1);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  // Birinchi render SSR ma'lumoti bilan ishlaydi — so'rov takrorlanmasin.
  const birinchi = useRef(true);
  // Sekin javob tezidan keyin kelib, eski ro'yxatni tiklab qo'ymasin.
  const sorovNavbati = useRef(0);

  const yukla = useCallback(
    async (f: Filtr, p: number) => {
      const navbat = ++sorovNavbati.current;
      setYuklanmoqda(true);
      setXato(null);
      const params = new URLSearchParams({
        holat: f.holat,
        page: String(p),
        pageSize: String(boshlangich.pageSize),
      });
      if (f.q.trim()) params.set("q", f.q.trim());
      if (f.rol) params.set("rol", f.rol);
      if (f.biznes) params.set("biznes", f.biznes);

      try {
        const res = await fetch(`/api/users?${params}`);
        if (navbat !== sorovNavbati.current) return;
        if (!res.ok) {
          setXato((await res.json()).error ?? "Ro'yxatni yuklab bo'lmadi");
          return;
        }
        const data = await res.json();
        setXodimlar(data.items);
        setTotal(data.total);
        setSanoq(data.sanoq);
      } catch {
        if (navbat === sorovNavbati.current) setXato("Tarmoq xatosi — qaytadan urinib ko'ring");
      } finally {
        if (navbat === sorovNavbati.current) setYuklanmoqda(false);
      }
    },
    [boshlangich.pageSize]
  );

  useEffect(() => {
    if (birinchi.current) {
      birinchi.current = false;
      return;
    }
    const t = setTimeout(() => void yukla(filtr, page), KUTISH_MS);
    return () => clearTimeout(t);
  }, [filtr, page, yukla]);

  /** Filtr o'zgarsa doim birinchi sahifaga qaytamiz. */
  const setFiltr = useCallback((yangi: Partial<Filtr>) => {
    setPage(1);
    setFiltrHolati((oldin) => ({ ...oldin, ...yangi }));
  }, []);

  /** Serverdan kelgan yangilangan xodimni ro'yxatga qo'yadi. */
  const almashtir = useCallback((x: XodimDTO) => {
    setXodimlar((oldin) => oldin.map((u) => (u.id === x.id ? x : u)));
  }, []);

  /** Yaratish/o'chirishdan keyin — sanoqlar ham o'zgargani uchun to'liq qayta yuklash. */
  const qaytaYukla = useCallback(() => void yukla(filtr, page), [yukla, filtr, page]);

  return {
    xodimlar,
    total,
    sanoq,
    filtr,
    setFiltr,
    page,
    setPage,
    pageSize: boshlangich.pageSize,
    yuklanmoqda,
    xato,
    almashtir,
    qaytaYukla,
  };
}
