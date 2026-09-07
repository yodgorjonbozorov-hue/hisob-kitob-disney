"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * "Demoni ochish" tugmasi — sessiyani serverda ochadi va ilovaga o'tadi.
 *
 * Xatolar mehmonga TUSHUNARLI qilib ko'rsatiladi: demo hali ekilmagan
 * (503) yoki foydalanuvchi allaqachon tizimda (409) holatlari normal
 * vaziyatlar, ular "xato" kabi ko'rinmasligi kerak.
 */
export function DemoBoshlash() {
  const router = useRouter();
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState<string | null>(null);

  async function ochish() {
    setYuklanmoqda(true);
    setXato(null);
    try {
      const res = await fetch("/api/demo/kirish", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/app");
        router.refresh();
        return;
      }
      if (data?.kirgan) {
        // Haqiqiy sessiya buzilmadi — foydalanuvchini o'z ilovasiga qaytaramiz.
        router.push("/app");
        return;
      }
      setXato(data?.error ?? "Demoni ochib bo'lmadi. Keyinroq urinib ko'ring.");
    } catch {
      setXato("Aloqa uzildi. Internetni tekshirib, qayta urining.");
    } finally {
      setYuklanmoqda(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={ochish} loading={yuklanmoqda} className="w-full">
        Demoni ochish
      </Button>
      {xato && <p className="text-sm text-expense-fg text-center">{xato}</p>}
    </div>
  );
}
