"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const MAKS_TOMONI = 720;
const JPEG_SIFAT = 0.72;

/**
 * SELFIE OLISH — old kamera bilan to'g'ridan-to'g'ri suratga olish.
 * Galereyadan tanlash ATAYLAB yo'q: `getUserMedia` ishlamagan brauzerda
 * `capture="user"` file input ochiladi — u ham kamerani ochadi.
 */
export function KameraOlish({
  ochiq,
  onYopish,
  onSurat,
}: {
  ochiq: boolean;
  onYopish: () => void;
  onSurat: (base64: string, mime: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faylRef = useRef<HTMLInputElement | null>(null);
  const [xato, setXato] = useState<string | null>(null);
  const [tayyor, setTayyor] = useState(false);

  const toxtat = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setTayyor(false);
  }, []);

  useEffect(() => {
    if (!ochiq) {
      toxtat();
      return;
    }
    let bekor = false;
    setXato(null);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (bekor) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setTayyor(true);
      } catch {
        setXato("Kameraga ruxsat berilmadi — quyidagi tugma orqali suratga oling");
      }
    })();
    return () => {
      bekor = true;
      toxtat();
    };
  }, [ochiq, toxtat]);

  function siqibYubor(manba: HTMLVideoElement | HTMLImageElement, kenglik: number, balandlik: number) {
    const masshtab = Math.min(1, MAKS_TOMONI / Math.max(kenglik, balandlik));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(kenglik * masshtab);
    canvas.height = Math.round(balandlik * masshtab);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(manba, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_SIFAT);
    const base64 = dataUrl.split(",")[1] ?? "";
    toxtat();
    onSurat(base64, "image/jpeg");
  }

  function suratOl() {
    const video = videoRef.current;
    if (!video || !tayyor) return;
    siqibYubor(video, video.videoWidth || 720, video.videoHeight || 720);
  }

  function fayldanOl(fayl: File | undefined) {
    if (!fayl) return;
    const url = URL.createObjectURL(fayl);
    const img = new Image();
    img.onload = () => {
      siqibYubor(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setXato("Rasmni o'qib bo'lmadi — qaytadan urinib ko'ring");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <Modal open={ochiq} onClose={onYopish} title="Selfie — davomat tasdig'i">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Selfie va lokatsiya faqat davomatni tasdiqlash uchun ishlatiladi.
        </p>
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover -scale-x-100" />
          {!tayyor && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80 p-4 text-center">
              {xato ?? "Kamera ochilmoqda..."}
            </div>
          )}
        </div>
        {xato ? (
          <>
            <input
              ref={faylRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => fayldanOl(e.target.files?.[0])}
            />
            <Button className="w-full" onClick={() => faylRef.current?.click()}>
              Kamera orqali suratga olish
            </Button>
          </>
        ) : (
          <Button className="w-full" size="lg" disabled={!tayyor} onClick={suratOl}>
            Suratga olish
          </Button>
        )}
      </div>
    </Modal>
  );
}
