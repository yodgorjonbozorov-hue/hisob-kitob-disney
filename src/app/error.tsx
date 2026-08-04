"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/lib/brand";

/**
 * Sahifa xatosi — Next.js'ning ingliz tilidagi standart ekrani o'rniga.
 *
 * Alohida holat: DEPLOY paytida brauzerdagi eski sahifa yangi versiyadagi
 * JS bo'lagini yuklay olmaydi ("ChunkLoadError"). Bu xato emas — tizim
 * yangilangan; shuning uchun sahifa bir marta avtomatik yangilanadi.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const yangilanish = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(
    `${error.name} ${error.message}`
  );

  useEffect(() => {
    console.error("Sahifa xatosi:", error);
    if (!yangilanish) return;
    // Bir martalik avtomatik yangilash — cheksiz aylanishning oldini olamiz.
    const kalit = "balansa:chunk-reload";
    if (sessionStorage.getItem(kalit)) return;
    sessionStorage.setItem(kalit, "1");
    window.location.reload();
  }, [error, yangilanish]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-4xl mb-4">{yangilanish ? "🔄" : "⚠️"}</p>
        <h1 className="text-xl font-semibold text-fg">
          {yangilanish ? "Tizim yangilandi" : "Kutilmagan xatolik"}
        </h1>
        <p className="text-sm text-muted mt-2">
          {yangilanish
            ? "Yangi versiya chiqdi — sahifani yangilash kifoya. Ma'lumotlaringiz joyida."
            : "Sahifani ochib bo'lmadi. Ma'lumotlaringiz saqlanib qoldi — qaytadan urinib ko'ring."}
        </p>

        <div className="flex gap-2 justify-center mt-6">
          <Button onClick={() => (yangilanish ? window.location.reload() : reset())}>
            {yangilanish ? "Sahifani yangilash" : "Qayta urinish"}
          </Button>
          <Link href="/app">
            <Button variant="secondary">Bosh sahifa</Button>
          </Link>
        </div>

        {error.digest && <p className="text-2xs text-faint mt-6">Xato kodi: {error.digest}</p>}
        <p className="text-2xs text-faint mt-1">
          Muammo takrorlansa — {BRAND.nomi} qo&apos;llab-quvvatlash xizmatiga shu kodni yuboring.
        </p>
      </div>
    </div>
  );
}
