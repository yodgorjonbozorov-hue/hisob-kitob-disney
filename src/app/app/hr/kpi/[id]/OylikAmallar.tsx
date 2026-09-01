"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { XodimOylikHisobi } from "@/lib/kpi/oylik";

/**
 * OYLIK ZANJIRI TUGMALARI: yopish → tasdiqlash → to'landi.
 *
 * Tugmalar HUQUQQA qarab ko'rinadi, lekin bu himoya EMAS: har amalni
 * server qaytadan tekshiradi (lib/kpi/ruxsat.ts). Bu yerda ko'rinish
 * faqat qulaylik uchun kesiladi.
 */
export function OylikAmallar({
  hisob,
  tasdiqMumkin,
  tolovMumkin,
  onYopish,
}: {
  hisob: XodimOylikHisobi;
  tasdiqMumkin: boolean;
  tolovMumkin: boolean;
  onYopish: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [ishlamoqda, setIshlamoqda] = useState(false);

  async function amal(yol: string, muvaffaqiyat: string) {
    setIshlamoqda(true);
    try {
      const res = await fetch(`/api/hr/kpi/oylik/${hisob.payrollId}/${yol}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ message: data.error ?? "Xatolik yuz berdi", tone: "error" });
        return;
      }
      toast({ message: muvaffaqiyat, tone: "success" });
      router.refresh();
    } catch {
      toast({ message: "Tarmoq xatosi — qayta urinib ko'ring", tone: "error" });
    } finally {
      setIshlamoqda(false);
    }
  }

  if (!tasdiqMumkin && !tolovMumkin) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {hisob.holat === "QORALAMA" && tasdiqMumkin && (
        <Button size="sm" onClick={onYopish}>
          Oyni yopish
        </Button>
      )}

      {hisob.holat === "HISOBLANDI" && (
        <>
          {tasdiqMumkin && (
            <Button
              size="sm"
              onClick={() => amal("tasdiq", "Oylik tasdiqlandi")}
              disabled={ishlamoqda}
            >
              Oylikni tasdiqlash
            </Button>
          )}
          {tasdiqMumkin && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => amal("qayta-ochish", "Oy qayta ochildi")}
              disabled={ishlamoqda}
            >
              Qayta ochish
            </Button>
          )}
        </>
      )}

      {hisob.holat === "TASDIQLANDI" && (
        <>
          {tolovMumkin && (
            <Button size="sm" onClick={() => amal("tolov", "To'landi deb belgilandi")} disabled={ishlamoqda}>
              To&apos;landi
            </Button>
          )}
          {tasdiqMumkin && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => amal("qayta-ochish", "Oy qayta ochildi")}
              disabled={ishlamoqda}
            >
              Qayta ochish
            </Button>
          )}
        </>
      )}
    </div>
  );
}
