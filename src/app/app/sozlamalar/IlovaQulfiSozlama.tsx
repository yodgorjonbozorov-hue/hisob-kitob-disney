"use client";

import { useCallback, useEffect, useState } from "react";
import { ScanFace } from "lucide-react";
import { iosIlovaMi, qulfOchir, qulfSozlamasi, qulfYoq } from "@/lib/native/qulf";

/**
 * Face ID / Touch ID bilan ilova qulfi.
 *
 * Faqat native iOS ilovasida ko'rinadi: brauzerda bunday imkoniyat yo'q va
 * bo'sh kartochka ko'rsatishning ma'nosi ham yo'q.
 */
export function IlovaQulfiSozlama() {
  const [korinsin, setKorinsin] = useState(false);
  const [mavjud, setMavjud] = useState(false);
  const [turi, setTuri] = useState("Face ID");
  const [yoqilgan, setYoqilgan] = useState(false);
  const [band, setBand] = useState(false);

  const yukla = useCallback(async () => {
    const s = await qulfSozlamasi();
    setMavjud(s.mavjud);
    setTuri(s.turi);
    setYoqilgan(s.yoqilgan);
  }, []);

  useEffect(() => {
    if (!iosIlovaMi()) return;
    setKorinsin(true);
    void yukla();
  }, [yukla]);

  if (!korinsin) return null;

  async function almashtir() {
    setBand(true);
    // Natija qanday bo'lishidan qat'i nazar holatni bazadan emas, qurilmadan
    // qayta o'qiymiz — foydalanuvchi bekor qilgan bo'lsa tugma qaytib turadi.
    if (yoqilgan) await qulfOchir();
    else await qulfYoq();
    await yukla();
    setBand(false);
  }

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-card p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-wash text-brand flex items-center justify-center shrink-0">
          <ScanFace className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-fg">Ilova qulfi</p>
          <p className="text-sm text-muted mt-1">
            {mavjud
              ? `Ilova ochilganda ${turi} so'raladi. Telefoningiz boshqa qo'lga o'tsa ham moliyaviy ma'lumot ko'rinmaydi.`
              : `Bu qurilmada ${turi} sozlanmagan. Telefon sozlamalaridan yoqing.`}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={yoqilgan}
          aria-label="Ilova qulfi"
          disabled={!mavjud || band}
          onClick={() => void almashtir()}
          className={`relative w-12 h-7 rounded-full shrink-0 transition-colors disabled:opacity-40 ${
            yoqilgan ? "bg-brand" : "bg-line-strong"
          }`}
        >
          <span
            className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
              yoqilgan ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
