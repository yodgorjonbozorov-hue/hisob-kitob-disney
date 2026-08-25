"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

/**
 * Biznes maydonlarini saqlash — bitta joyda (PATCH /api/businesses/[id]).
 *
 * Server bayroqlar mosligini O'ZI majburlaydi (ombor o'chsa kassa ham
 * o'chadi), shuning uchun bu yerda javobdagi holat qaytariladi va UI shu
 * bo'yicha yangilanadi — client taxmin qilmaydi.
 */
export function useBiznesSaqlash(id: string) {
  const router = useRouter();
  const { toast } = useToast();
  const [band, setBand] = useState(false);

  async function saqla(
    data: Record<string, unknown>,
    xabar?: string
  ): Promise<Record<string, unknown> | null> {
    setBand(true);
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const javob = await res.json();
      if (!res.ok) {
        toast({ message: javob.error ?? "Saqlab bo'lmadi", tone: "error" });
        return null;
      }
      if (xabar) toast({ message: xabar, tone: "success" });
      router.refresh();
      return javob;
    } catch {
      toast({ message: "Serverga ulanib bo'lmadi", tone: "error" });
      return null;
    } finally {
      setBand(false);
    }
  }

  return { saqla, band };
}
