"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { XatoHolat } from "@/components/superadmin/Holatlar";

/**
 * Control Center xato chegarasi.
 *
 * Foydalanuvchiga STACK TRACE ko'rsatilmaydi (talab 56) — faqat tushunarli
 * xabar va `digest` (Next.js beradigan so'rov identifikatori). To'liq xato
 * server jurnaliga chiqadi.
 */
export default function ControlCenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Control Center xatosi:", error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto mt-10">
      <XatoHolat
        requestId={error.digest ?? null}
        qaytaUrin={<Button onClick={reset}>Qayta urinish</Button>}
      />
    </div>
  );
}
