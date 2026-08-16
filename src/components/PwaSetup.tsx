"use client";

import { useEffect, useState } from "react";
import { X, Share, PlusSquare } from "lucide-react";
import { nativeMi } from "@/lib/native/kopruk";

/** Chrome/Edge beruvchi o'rnatish hodisasi (standart tipda yo'q). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const RAD_KALIT = "pwa_rad_vaqti";
const RAD_KUN = 30;

/** Foydalanuvchi banner'ni yopgan bo'lsa RAD_KUN kungacha qayta ko'rsatilmaydi. */
function radEtilganmi(): boolean {
  try {
    const v = localStorage.getItem(RAD_KALIT);
    if (!v) return false;
    return Date.now() - Number(v) < RAD_KUN * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * PWA sozlash: service worker'ni ro'yxatga oladi va mobil brauzerda
 * "Ilovani o'rnatish" banner'ini ko'rsatadi.
 *  - Android/Chrome: beforeinstallprompt orqali haqiqiy o'rnatish oynasi.
 *  - iPhone/Safari: hodisa yo'q — "Ulashish → Ekranga qo'shish" yo'riqnomasi.
 * Ilova ichidan (standalone) ochilganda hech narsa ko'rsatilmaydi.
 */
export function PwaSetup() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosKorsat, setIosKorsat] = useState(false);
  const [yopiq, setYopiq] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Eski iOS Safari'da standalone alohida maydonda.
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    // App Store ilovasi ICHIDA "ilovani o'rnating" taklifi ma'nosiz —
    // foydalanuvchi allaqachon ilovada (App Store buni ham rad sababi qiladi).
    if (standalone || nativeMi() || radEtilganmi()) return;

    const mobil = window.matchMedia("(max-width: 1024px)").matches;
    if (!mobil) return;

    const tinglovchi = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setYopiq(false);
    };
    window.addEventListener("beforeinstallprompt", tinglovchi);

    // iOS'da beforeinstallprompt kelmaydi — Safari bo'lsa yo'riqnoma banner'i.
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (ios) {
      setIosKorsat(true);
      setYopiq(false);
    }
    return () => window.removeEventListener("beforeinstallprompt", tinglovchi);
  }, []);

  if (yopiq) return null;

  const yop = () => {
    setYopiq(true);
    try {
      localStorage.setItem(RAD_KALIT, String(Date.now()));
    } catch {}
  };

  return (
    <div className="fixed bottom-20 lg:bottom-4 inset-x-3 z-50 max-w-md mx-auto rounded-xl border border-line bg-surface shadow-lg p-3 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon-256.png" alt="" className="w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold text-fg">Balansa ilovasini o&apos;rnating</p>
        {iosKorsat && !installEvent ? (
          <p className="text-xs text-muted flex items-center gap-1 flex-wrap">
            <Share className="w-3.5 h-3.5 inline" /> Ulashish tugmasi →
            <PlusSquare className="w-3.5 h-3.5 inline" /> &quot;Ekranga qo&apos;shish&quot;
          </p>
        ) : (
          <p className="text-xs text-muted">Telefonda ilova kabi tez ochiladi</p>
        )}
      </div>
      {installEvent && (
        <button
          type="button"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold"
          onClick={async () => {
            await installEvent.prompt();
            const { outcome } = await installEvent.userChoice;
            if (outcome === "accepted") setYopiq(true);
          }}
        >
          O&apos;rnatish
        </button>
      )}
      <button type="button" onClick={yop} aria-label="Yopish" className="shrink-0 text-faint p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
