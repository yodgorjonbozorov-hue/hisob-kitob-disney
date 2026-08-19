"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  kameraHolati,
  KAMERASIZ_YORIQNOMA,
  type BarcodeDetectorCtor,
} from "@/lib/magazin/kameraQollab";

/**
 * KAMERA SKANERI — telefon/noutbuk kamerasi orqali QR va shtrix-kod o'qish.
 *
 * Brauzerning o'z `BarcodeDetector` API'si ishlatiladi. U iPhone Safari'da
 * (va iOS'dagi barcha brauzerlarda, chunki hammasi WebKit) YO'Q — sabablari
 * va dekoder kutubxonasi qo'shilmagani `lib/magazin/kameraQollab.ts` da.
 *
 * Qo'llab-quvvatlanmaganda bu oyna BOSH KETMAYDI: nima qilish kerakligini
 * aytadi va foydalanuvchini qidiruvga qaytaradi (`onFallback`) — o'sha yo'l
 * har doim ishlaydi.
 */
export function KameraSkaner({
  onKod,
  onClose,
  onFallback,
}: {
  onKod: (kod: string) => void;
  onClose: () => void;
  /** Kamera ishlamasa — qidiruv maydoniga qaytarish. */
  onFallback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  // Boshlang'ich holat SINXRON aniqlanadi: qo'llab-quvvatlanmaydigan
  // brauzerda kamera oynasi bir lahza ham "yuklanmoqda" ko'rinishida
  // turmasin — foydalanuvchi darhol nima qilishni bilsin.
  const [qollab] = useState(() => kameraHolati().qollab);

  useEffect(() => {
    const holat = kameraHolati();
    if (!holat.qollab) {
      setXato(holat.sabab);
      return;
    }

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let toxtadi = false;

    async function boshla() {
      const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // Telefonda orqa kamera — kod o'qish uchun aynan u kerak.
          video: { facingMode: "environment" },
        });
      } catch {
        setXato("Kameraga ruxsat berilmadi.");
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
    <Modal open onClose={onClose} title={xato ? "Kamera ishlamaydi" : "Kamera bilan skanerlash"}>
      <div className="space-y-3">
        {xato ? (
          <div data-test="kamera-fallback" className="space-y-3">
            <p className="text-sm text-expense-fg bg-expense-soft border border-expense/40 rounded-lg px-3 py-2">
              {xato}
            </p>
            <div>
              <p className="text-sm font-medium text-fg mb-2">Nima qilish mumkin:</p>
              <ul className="space-y-1.5">
                {KAMERASIZ_YORIQNOMA.map((q) => (
                  <li key={q} className="text-sm text-muted flex gap-2">
                    <span className="text-brand shrink-0">→</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
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

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Yopish
          </Button>
          {/* Kamera ishlamaganda ASOSIY harakat — qidiruvga qaytish. */}
          {(xato || !qollab) && <Button onClick={onFallback}>Qidiruvga o&apos;tish</Button>}
        </div>
      </div>
    </Modal>
  );
}
