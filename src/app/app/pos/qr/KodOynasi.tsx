"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * KOD OYNASI — QR yoki shtrix-kodni ko'rsatadi, PNG'ga yuklaydi va chop etadi.
 *
 * SVG serverdan olinadi (`/api/pos/kod`), PNG esa BRAUZERDA canvas orqali
 * yasaladi: shu bois serverga rastr kutubxonasi (sharp/canvas) kerak
 * bo'lmaydi — u Vercel build hajmini sezilarli oshirardi.
 */
export function KodOynasi({
  kod,
  turi,
  nomi,
  onClose,
}: {
  kod: string;
  turi: "qr" | "barcode";
  nomi: string;
  onClose: () => void;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const oynaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let bekor = false;
    (async () => {
      try {
        const res = await fetch("/api/pos/kod", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kod, turi }),
        });
        const data = await res.json();
        if (bekor) return;
        if (!res.ok) {
          setXato(data.error ?? "Kodni chizib bo'lmadi");
          return;
        }
        setSvg(data.svg);
      } catch {
        if (!bekor) setXato("Serverga ulanib bo'lmadi");
      }
    })();
    return () => {
      bekor = true;
    };
  }, [kod, turi]);

  /** SVG -> PNG: canvas'ga chizib, `toBlob` bilan faylga aylantiramiz. */
  async function pngYukla() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("rasm yuklanmadi"));
        img.src = url;
      });
      // 3x masshtab: chop etilganda kod donador bo'lib qolmasin.
      const canvas = document.createElement("canvas");
      canvas.width = (img.width || 240) * 3;
      canvas.height = (img.height || 240) * 3;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${kod}.png`;
      a.click();
    } catch {
      setXato("PNG yasab bo'lmadi — chop etishdan foydalaning");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Chop etish: faqat stikerni o'z ichiga olgan alohida oyna ochiladi. */
  function chopEt() {
    if (!svg) return;
    const w = window.open("", "_blank", "width=420,height=520");
    if (!w) {
      setXato("Chop etish oynasi bloklandi — brauzer sozlamalarini tekshiring");
      return;
    }
    w.document.write(
      `<!doctype html><html><head><title>${kod}</title>` +
        `<style>body{font-family:sans-serif;text-align:center;padding:24px}` +
        `p{margin:8px 0 0;font-size:13px}</style></head><body>` +
        `${svg}<p>${nomi}</p><p style="color:#666">${kod}</p></body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Modal open onClose={onClose} title={turi === "qr" ? "Balansa QR" : "Shtrix-kod"}>
      <div className="space-y-4">
        <div
          ref={oynaRef}
          className="flex items-center justify-center bg-white rounded-xl p-4 border border-line min-h-[180px]"
          // SVG server tomonda generatsiya qilinadi (foydalanuvchi matni emas)
          // va ichidagi har qanday matn `xmlXavfsiz` bilan ekranlanadi.
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        >
          {!svg && !xato ? <span className="text-sm text-muted">Chizilmoqda...</span> : null}
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-fg">{nomi}</p>
          <p className="text-xs text-faint font-mono mt-0.5">{kod}</p>
        </div>

        {xato && (
          <p className="text-sm text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
            {xato}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Yopish
          </Button>
          <Button variant="secondary" onClick={pngYukla} disabled={!svg}>
            PNG yuklash
          </Button>
          <Button onClick={chopEt} disabled={!svg}>
            Chop etish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
