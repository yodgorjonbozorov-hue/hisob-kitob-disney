"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Telegram orqali kirish holati (brauzer tomoni).
 *
 * `boshla()` — bir martalik havola oladi; keyin har 2 soniyada holat so'raladi.
 * Foydalanuvchi Telegram'dan sahifaga QAYTGANDA (`visibilitychange`) darhol
 * so'raladi — 2 soniya kutib o'tirmaydi. Tasdiqlansa sessiya server javobida
 * ochilgan bo'ladi, faqat sahifaga o'tiladi.
 */
export type TgBosqich =
  | { tur: "boshlangich" }
  | { tur: "yuklanmoqda" }
  | { tur: "kutilmoqda"; token: string; havola: string; bot: string; tugash: number }
  | { tur: "kirilmoqda" }
  | { tur: "xato"; sabab: "boglanmagan" | "rad" | "eskirgan" | "tarmoq" | "limit" };

const SOROV_ORALIGI_MS = 2000;

export function useTelegramKirish() {
  const router = useRouter();
  const [bosqich, setBosqich] = useState<TgBosqich>({ tur: "boshlangich" });
  const [qolgan, setQolgan] = useState(0);
  const sorovda = useRef(false);

  const tekshir = useCallback(async () => {
    if (bosqich.tur !== "kutilmoqda" || sorovda.current) return;
    if (Date.now() >= bosqich.tugash) {
      setBosqich({ tur: "xato", sabab: "eskirgan" });
      return;
    }
    sorovda.current = true;
    try {
      const res = await fetch("/api/auth/telegram/holat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: bosqich.token }),
      });
      const data = (await res.json()) as { holat?: string; rol?: string };
      if (data.holat === "tasdiqlandi") {
        setBosqich({ tur: "kirilmoqda" });
        router.push(data.rol === "SUPERADMIN" ? "/superadmin" : "/app");
        router.refresh();
      } else if (data.holat === "boglanmagan" || data.holat === "rad" || data.holat === "eskirgan") {
        setBosqich({ tur: "xato", sabab: data.holat });
      }
    } catch {
      // Bir martalik tarmoq uzilishi — keyingi so'rovda qayta uriniladi.
    } finally {
      sorovda.current = false;
    }
  }, [bosqich, router]);

  // Davriy so'rov + sahifaga qaytganda darhol so'rov.
  useEffect(() => {
    if (bosqich.tur !== "kutilmoqda") return;
    const t = setInterval(tekshir, SOROV_ORALIGI_MS);
    const korindi = () => {
      if (document.visibilityState === "visible") void tekshir();
    };
    document.addEventListener("visibilitychange", korindi);
    window.addEventListener("focus", korindi);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", korindi);
      window.removeEventListener("focus", korindi);
    };
  }, [bosqich, tekshir]);

  // Qolgan vaqt sanog'i (soniya).
  useEffect(() => {
    if (bosqich.tur !== "kutilmoqda") return;
    const yangila = () => setQolgan(Math.max(0, Math.ceil((bosqich.tugash - Date.now()) / 1000)));
    yangila();
    const t = setInterval(yangila, 1000);
    return () => clearInterval(t);
  }, [bosqich]);

  async function boshla() {
    setBosqich({ tur: "yuklanmoqda" });
    try {
      const res = await fetch("/api/auth/telegram/boshlash", { method: "POST" });
      if (res.status === 429) {
        setBosqich({ tur: "xato", sabab: "limit" });
        return;
      }
      const data = (await res.json()) as { token: string; havola: string; bot: string; expiresAt: number };
      if (!res.ok || !data.token) throw new Error();
      setBosqich({ tur: "kutilmoqda", token: data.token, havola: data.havola, bot: data.bot, tugash: data.expiresAt });
    } catch {
      setBosqich({ tur: "xato", sabab: "tarmoq" });
    }
  }

  async function bekor() {
    if (bosqich.tur === "kutilmoqda") {
      // Javobni kutmaymiz: foydalanuvchi uchun bekor qilish darhol.
      void fetch("/api/auth/telegram/bekor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: bosqich.token }),
      }).catch(() => {});
    }
    setBosqich({ tur: "boshlangich" });
  }

  return { bosqich, qolgan, boshla, bekor, qaytaTekshir: tekshir };
}
