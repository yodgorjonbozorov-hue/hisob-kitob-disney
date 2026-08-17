"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
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
        <span
          className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 ${
            yangilanish ? "bg-brand-wash text-brand" : "bg-debt-soft text-debt-fg"
          }`}
        >
          {yangilanish ? (
            <RefreshCw className="w-7 h-7" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <TriangleAlert className="w-7 h-7" strokeWidth={1.75} aria-hidden="true" />
          )}
        </span>
        <h1 className="font-heading text-lg font-semibold text-fg">
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
          <LinkButton href="/app" variant="secondary">
            Bosh sahifa
          </LinkButton>
        </div>

        {error.digest && <p className="text-2xs text-faint mt-6">Xato kodi: {error.digest}</p>}
        <p className="text-2xs text-faint mt-1">
          Muammo takrorlansa — {BRAND.nomi} qo&apos;llab-quvvatlash xizmatiga shu kodni yuboring.
        </p>
      </div>
    </div>
  );
}
