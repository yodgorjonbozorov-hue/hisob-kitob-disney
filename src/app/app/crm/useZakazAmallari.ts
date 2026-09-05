"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zakazUstuni, type Ustun } from "@/lib/crm/pipeline";
import type { BuyurtmaDTO } from "./turlar";

/**
 * ZAKAZ USTIDAGI AMALLAR — ustunga ko'chirish, yo'qotildi, o'chirish.
 *
 * NEGA ALOHIDA HOOK: `CrmClient` da allaqachon sudrab tashlash, sahifalash
 * va to'rtta oyna bor. Amallar u yerda qolsa komponent 250 satrdan oshardi
 * (loyiha qoidasi). Bu yerda faqat SERVER bilan gaplashish va optimistik
 * yozuv; qaysi oyna ochilishi — komponentning ishi.
 *
 * "Yutildi" bu yerda YO'Q: u pul yozadigan amal va alohida tasdiq oynasidan
 * o'tadi (`YakunlashTasdiq`) — sudrab tashlash bilan bajarilmasin.
 */
export function useZakazAmallari({
  bugun,
  onOzgardi,
}: {
  bugun: string;
  /** Zakaz mahalliy ravishda yangi holatga yozilsin (optimistik ko'chish). */
  onOzgardi: (b: BuyurtmaDTO, holat: string, sana?: string | null) => void;
}) {
  const router = useRouter();
  const [xato, setXato] = useState<string | null>(null);
  const [band, setBand] = useState(false);

  async function patch(id: string, tana: Record<string, unknown>): Promise<boolean> {
    setXato(null);
    setBand(true);
    try {
      const res = await fetch(`/api/crm/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tana),
      });
      if (!res.ok) {
        setXato((await res.json()).error ?? "Xatolik yuz berdi");
        return false;
      }
      return true;
    } finally {
      setBand(false);
    }
  }

  /**
   * USTUNGA KO'CHIRISH. "Bugungi" — HOLAT emas, SANA: zakaz sanasi bugunga
   * suriladi (`lib/crm/pipeline.ts` qoidasi).
   */
  async function ustungaKochirish(b: BuyurtmaDTO, ustun: Ustun): Promise<boolean> {
    if (zakazUstuni(b.holat, b.sana, bugun) === ustun) return false;
    const tana =
      ustun === "BUGUNGI"
        ? { bugungaKochir: true }
        : { holat: ustun === "JARAYONDA" ? "JARAYONDA" : "KUTILMOQDA" };
    if (!(await patch(b.id, tana))) return false;
    if (ustun === "BUGUNGI") onOzgardi(b, b.holat, bugun);
    else onOzgardi(b, ustun === "JARAYONDA" ? "JARAYONDA" : "KUTILMOQDA");
    router.refresh();
    return true;
  }

  /** Yo'qotildi — SABAB bilan (server sababni zakazga yozadi). */
  async function yoqotildi(b: BuyurtmaDTO, sabab: string): Promise<boolean> {
    if (!(await patch(b.id, { holat: "YOQOTILDI", yoqotishSababi: sabab }))) return false;
    onOzgardi(b, "YOQOTILDI");
    router.refresh();
    return true;
  }

  /**
   * ZAKAZNI O'CHIRISH — yumshoq, faqat direktor. Server ham `requireManager`
   * bilan tekshiradi: tugmani yashirish himoya emas.
   */
  async function ochirish(b: BuyurtmaDTO): Promise<boolean> {
    setXato(null);
    setBand(true);
    try {
      const res = await fetch(`/api/crm/deals/${b.id}`, { method: "DELETE" });
      if (!res.ok) {
        setXato((await res.json()).error ?? "O'chirib bo'lmadi");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBand(false);
    }
  }

  return { xato, setXato, band, ustungaKochirish, yoqotildi, ochirish };
}
