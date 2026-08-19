"use client";

import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { PosMahsulotDTO } from "@/lib/queries/pos";
import type { SavatSatri } from "./Savat";

/**
 * SAVAT HOLATI va KOD OQIMI.
 *
 * Uch xil kirish yo'li (apparat skaner, kamera, qidiruv maydoni) shu yerdagi
 * `kodQoshildi` ga quyiladi — kassa ekranida kod qayerdan kelgani ahamiyatsiz.
 *
 * TEZLIK: kod avval MAHALLIY xaritadan qidiriladi (mahsulotlar sahifa bilan
 * birga kelgan), topilmagandagina serverga so'rov ketadi. Odatiy skanerlash
 * shu bois tarmoqni umuman kutmaydi.
 */
export function useSavat(mahsulotlar: PosMahsulotDTO[]) {
  const { toast } = useToast();
  const [satrlar, setSatrlar] = useState<SavatSatri[]>([]);

  /** Kod -> mahsulot xaritasi: skanerlashda O(1) qidiruv. */
  const kodXarita = useMemo(() => {
    const m = new Map<string, PosMahsulotDTO>();
    for (const p of mahsulotlar) {
      if (p.barcode) m.set(p.barcode.toUpperCase(), p);
      if (p.qrKod) m.set(p.qrKod.toUpperCase(), p);
      if (p.sku) m.set(p.sku.toUpperCase(), p);
    }
    return m;
  }, [mahsulotlar]);

  /**
   * Mahsulotni savatga qo'shadi. Allaqachon savatda bo'lsa YANGI SATR
   * qo'shilmaydi — miqdor oshadi (1 → 2 → 3). Aks holda 12 dona olgan
   * xaridorning cheki 12 satrdan iborat bo'lardi.
   */
  const qosh = useCallback((p: PosMahsulotDTO) => {
    setSatrlar((prev) => {
      const bor = prev.find((s) => s.productId === p.id);
      if (bor) {
        return prev.map((s) => (s.productId === p.id ? { ...s, miqdor: s.miqdor + 1 } : s));
      }
      return [
        ...prev,
        {
          productId: p.id,
          nomi: p.nomi,
          birlik: p.birlik,
          katalogNarx: p.sotuvNarx,
          birlikNarx: p.sotuvNarx,
          miqdor: 1,
          qoldiq: p.miqdor,
        },
      ];
    });
  }, []);

  const kodQoshildi = useCallback(
    async (xomKod: string): Promise<boolean> => {
      const kod = xomKod.trim();
      if (!kod) return false;

      const mahalliy = kodXarita.get(kod.toUpperCase());
      if (mahalliy) {
        qosh(mahalliy);
        return true;
      }

      // Mahalliy ro'yxatda yo'q — sahifa ochilgandan keyin qo'shilgan yoki
      // kodi endi biriktirilgan mahsulot bo'lishi mumkin.
      try {
        const res = await fetch("/api/pos/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kod }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ message: data.error ?? "Kodni tekshirib bo'lmadi", tone: "error" });
          return false;
        }
        if (!data.topildi) {
          toast({ message: `"${kod}" kodli mahsulot topilmadi`, tone: "error" });
          return false;
        }
        qosh({ ...data.mahsulot, sku: null, categoryId: null });
        return true;
      } catch {
        toast({ message: "Serverga ulanib bo'lmadi", tone: "error" });
        return false;
      }
    },
    [kodXarita, qosh, toast]
  );

  const miqdor = useCallback((productId: string, m: number) => {
    setSatrlar((prev) =>
      m <= 0
        ? prev.filter((s) => s.productId !== productId)
        : prev.map((s) => (s.productId === productId ? { ...s, miqdor: m } : s))
    );
  }, []);

  const narx = useCallback((productId: string, n: number) => {
    setSatrlar((prev) =>
      prev.map((s) => (s.productId === productId ? { ...s, birlikNarx: Math.max(0, n) } : s))
    );
  }, []);

  const ochir = useCallback((productId: string) => {
    setSatrlar((prev) => prev.filter((s) => s.productId !== productId));
  }, []);

  const tozala = useCallback(() => setSatrlar([]), []);

  const jami = satrlar.reduce((a, s) => a + s.birlikNarx * s.miqdor, 0);

  return { satrlar, jami, qosh, kodQoshildi, miqdor, narx, ochir, tozala };
}
