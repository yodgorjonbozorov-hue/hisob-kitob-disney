"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * MODUL XATO EKRANI — har modulning `error.tsx` shu komponentni ishlatadi.
 *
 * Nega modul darajasida: bitta modulda (masalan omborda) xato chiqsa butun
 * kabinet emas, faqat shu bo'lim almashadi — yon menyu va biznes tanlash
 * joyida qoladi, foydalanuvchi boshqa bo'limga o'ta oladi.
 */
export function ModuleError({
  modul,
  error,
  reset,
}: {
  modul: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`${modul} xatosi:`, error);
  }, [modul, error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <h1 className="text-xl font-semibold text-fg">{modul} bo&apos;limini ochib bo&apos;lmadi</h1>
        <p className="text-sm text-muted mt-2">
          Ma&apos;lumotlaringiz saqlanib qoldi — qaytadan urinib ko&apos;ring.
        </p>

        <div className="flex gap-2 justify-center mt-6">
          <Button onClick={reset}>Qayta urinish</Button>
          <Link href="/app">
            <Button variant="secondary">Bosh sahifa</Button>
          </Link>
        </div>

        {error.digest && <p className="text-2xs text-faint mt-6">Xato kodi: {error.digest}</p>}
      </div>
    </div>
  );
}
