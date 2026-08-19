"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/**
 * KAMERA SKANERI — telefon/noutbuk kamerasi orqali QR va shtrix-kod o'qish.
 *
 * Brauzerning o'z `BarcodeDetector` API'si ishlatiladi (Android Chrome va
 * ish stolidagi Chrome/Edge'da bor). Tashqi dekoder kutubxonasi ATAYLAB
 * qo'shilmadi: u ~200 KB JS bo'lib, kassa ekranining ochilish tezligiga
 * urardi — apparat skaner esa bundan mustaqil ishlaydi.
 *
 * API yo'q yoki kameraga ruxsat berilmagan bo'lsa — bu oyna sababni aytadi
 * va foydalanuvchi QIDIRUV maydoniga qaytadi (fallback POS ekranida
 * doim ochiq turadi).
 */

/** Brauzerdagi `BarcodeDetector` — TypeScript tiplarida hali yo'q. */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

export function KameraSkaner({ onKod, onClose }: { onKod: (kod: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [xato, setXato] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let toxtadi = false;

    async function boshla() {
      const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Ctor) {
        setXato(
          "Bu brauzer kamera orqali kod o'qishni qo'llab-quvvatlamaydi. " +
            "Skanerdan foydalaning yoki mahsulotni qidiruvdan toping."
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setXato("Kameraga kirish mumkin emas. Qidiruvdan foydalaning.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // Telefonda orqa kamera — kod o'qish uchun aynan u kerak.
          video: { facingMode: "environment" },
        });
      } catch {
        setXato("Kameraga ruxsat berilmadi. Qidiruvdan foydalaning.");
        return;
      }
      if (toxtadi) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const detector = new Ctor({
        formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf"],
      });

      timer = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const natijalar = await detector.detect(videoRef.current);
          const kod = natijalar[0]?.rawValue?.trim();
          if (kod) {
            if (timer) clearInterval(timer);
            timer = null;
            onKod(kod);
          }
        } catch {
          // Bitta kadr o'qilmasa — keyingisida urinamiz (shovqin bosilmaydi).
        }
      }, 350);
    }

    void boshla();
    return () => {
      toxtadi = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onKod]);

  return (
    <Modal open onClose={onClose} title="Kamera bilan skanerlash">
      <div className="space-y-3">
        {xato ? (
          <p className="text-sm text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
            {xato}
          </p>
        ) : (
          <>
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-2/3 h-1/2 border-2 border-white/80 rounded-lg" />
              </div>
            </div>
            <p className="text-xs text-faint">
              Kodni ramka ichiga tutib turing. Topilishi bilan mahsulot savatga qo&apos;shiladi.
            </p>
          </>
        )}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Yopish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
