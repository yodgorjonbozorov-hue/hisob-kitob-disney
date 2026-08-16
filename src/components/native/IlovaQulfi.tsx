"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import {
  QULF_KALIT,
  biometrikaSora,
  iosIlovaMi,
  xotiraOchir,
  xotiraOqi,
} from "@/lib/native/qulf";

/** Ilova fonda shu muddatdan ko'p tursa — qayta Face ID so'raladi. */
const KUTISH_MS = 60_000;

type Holat = "tekshirilmoqda" | "ochiq" | "qulflangan";

/**
 * Ilova qulfi — moliyaviy ma'lumot telefon boshqa qo'lga o'tsa ham ochilmasin.
 *
 * Ishlashi:
 *  - faqat native iOS ilovada va faqat foydalanuvchi qulfni YOQQAN bo'lsa;
 *  - ilova ochilganda va fondan qaytganda (1 daqiqadan ko'p turgan bo'lsa)
 *    Face ID / Touch ID so'raladi;
 *  - tasdiqlanmaguncha ekran to'liq berkitiladi (ma'lumot ko'rinmaydi).
 *
 * Sessiyaga TEGMAYDI: bu qurilma darajasidagi himoya, server sessiyasi emas.
 * Shu sabab qulfni ochmasdan chiqish uchun "Hisobdan chiqish" tugmasi bor.
 */
export function IlovaQulfi() {
  const [holat, setHolat] = useState<Holat>("tekshirilmoqda");
  const [xato, setXato] = useState<string | null>(null);
  // Ilova fonga o'tgan vaqt. `null` — hali fonga o'tmagan.
  const fongaOtdi = useRef<number | null>(null);
  // Face ID oynasi ochiq turganda visibilitychange yana ishga tushmasin.
  const soralmoqda = useRef(false);

  const sora = useCallback(async () => {
    if (soralmoqda.current) return;
    soralmoqda.current = true;
    setXato(null);
    const natija = await biometrikaSora("Balansa ma'lumotlarini ochish");
    soralmoqda.current = false;

    if (natija === "ok") {
      setHolat("ochiq");
      return;
    }
    if (natija === "imkonsiz") {
      // Qurilmada Face ID o'chirilgan/o'chirib tashlangan — qulfni ushlab
      // turishning ma'nosi yo'q, aks holda foydalanuvchi ilovaga kira olmaydi.
      await xotiraOchir(QULF_KALIT);
      setHolat("ochiq");
      return;
    }
    setXato("Tasdiqlanmadi. Qayta urinib ko'ring.");
  }, []);

  // Boshlang'ich tekshiruv: qulf yoqilganmi?
  useEffect(() => {
    if (!iosIlovaMi()) {
      setHolat("ochiq");
      return;
    }
    let bekor = false;
    void (async () => {
      const yoqilgan = (await xotiraOqi(QULF_KALIT)) === "ha";
      if (bekor) return;
      if (!yoqilgan) {
        setHolat("ochiq");
        return;
      }
      setHolat("qulflangan");
      void sora();
    })();
    return () => {
      bekor = true;
    };
  }, [sora]);

  // Fondan qaytish: uzoq turgan bo'lsa qayta qulflaymiz.
  useEffect(() => {
    if (!iosIlovaMi()) return;

    const ozgardi = () => {
      if (document.visibilityState === "hidden") {
        // Face ID oynasi ham ilovani "hidden" qiladi — o'sha paytda
        // hisoblamaymiz, aks holda tasdiqlashdan keyin darhol qayta so'raladi.
        if (!soralmoqda.current) fongaOtdi.current = Date.now();
        return;
      }
      const ketgan = fongaOtdi.current;
      fongaOtdi.current = null;
      if (ketgan === null || Date.now() - ketgan < KUTISH_MS) return;

      void (async () => {
        if ((await xotiraOqi(QULF_KALIT)) !== "ha") return;
        setHolat("qulflangan");
        void sora();
      })();
    };

    document.addEventListener("visibilitychange", ozgardi);
    return () => document.removeEventListener("visibilitychange", ozgardi);
  }, [sora]);

  if (holat === "ochiq") return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-surface flex flex-col items-center justify-center px-8 text-center"
      // Ekran o'quvchi uchun: bu modal butun ilovani berkitadi.
      role="dialog"
      aria-modal="true"
      aria-label="Ilova qulflangan"
    >
      <div className="w-16 h-16 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mb-5">
        {xato ? <ShieldAlert className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
      </div>
      <p className="text-lg font-semibold text-fg">Balansa qulflangan</p>
      <p className="mt-2 text-sm text-muted max-w-xs">
        {holat === "tekshirilmoqda"
          ? "Tekshirilmoqda…"
          : "Davom etish uchun Face ID yoki qurilma parolingiz bilan tasdiqlang."}
      </p>
      {xato && <p className="mt-3 text-sm text-expense">{xato}</p>}

      {holat === "qulflangan" && (
        <button
          type="button"
          onClick={() => void sora()}
          className="mt-6 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold"
        >
          Tasdiqlash
        </button>
      )}

      <a
        href="/api/auth/logout"
        className="mt-4 text-xs text-muted underline underline-offset-4"
      >
        Boshqa hisob bilan kirish
      </a>
    </div>
  );
}
