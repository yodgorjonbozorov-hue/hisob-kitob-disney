"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buttonClass } from "@/components/ui/buttonStyles";
import { useTelegramKirish, type TgBosqich } from "./useTelegramKirish";

/**
 * "Telegram orqali kirish" — parol bilan kirishga QO'SHIMCHA yo'l.
 *
 * Telefonda: "Telegram'ni ochish" tugmasi ilovani ochadi. Kompyuterda: QR-kod —
 * telefon kamerasi bilan skanerlansa Telegram telefonda ochiladi, tasdiqdan
 * keyin kompyuterdagi sahifa o'zi kiradi.
 */
const XATO_MATNI: Record<Extract<TgBosqich, { tur: "xato" }>["sabab"], string> = {
  boglanmagan:
    "Telegram raqamingiz bilan akkaunt topilmadi. Login va parol bilan kiring yoki direktoringizdan " +
    "raqamingizni xodim kartochkasiga yozib qo'yishini so'rang.",
  rad: "Kirish Telegram'da rad etildi.",
  eskirgan: "So'rov vaqti tugadi. Qaytadan urinib ko'ring.",
  tarmoq: "Serverga ulanib bo'lmadi. Internetni tekshirib, qayta urining.",
  limit: "Juda ko'p urinish. Birozdan keyin qayta urining.",
};

function vaqtMatni(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TelegramKirish() {
  const { bosqich, qolgan, boshla, bekor } = useTelegramKirish();
  const [qr, setQr] = useState<string | null>(null);
  const havola = bosqich.tur === "kutilmoqda" ? bosqich.havola : null;

  useEffect(() => {
    if (!havola) {
      setQr(null);
      return;
    }
    let bekorQilindi = false;
    // Kutubxona faqat kerak bo'lganda yuklanadi — login sahifasi yengil qoladi.
    import("qrcode")
      .then((m) => m.default.toDataURL(havola, { margin: 1, width: 360, errorCorrectionLevel: "M" }))
      .then((url) => !bekorQilindi && setQr(url))
      .catch(() => {});
    return () => {
      bekorQilindi = true;
    };
  }, [havola]);

  if (bosqich.tur === "kutilmoqda" || bosqich.tur === "kirilmoqda") {
    return (
      <section aria-labelledby="tg-sarlavha" className="rounded-xl border border-line bg-surface-2 p-4 space-y-4">
        <div>
          <h2 id="tg-sarlavha" className="font-medium text-fg">
            Telegram&apos;da tasdiqlang
          </h2>
          <ol className="mt-2 space-y-1 text-sm text-muted list-decimal list-inside">
            <li>&quot;Telegram&apos;ni ochish&quot; tugmasini bosing</li>
            <li>Botda <span className="font-medium text-fg">Start</span> ni bosing</li>
            <li><span className="font-medium text-fg">📱 Raqamni yuborish</span>, so&apos;ng <span className="font-medium text-fg">Ha, kirish</span></li>
          </ol>
        </div>

        {havola && (
          <a
            href={havola}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("primary", "lg", "w-full")}
          >
            <Send className="h-5 w-5" aria-hidden="true" />
            Telegram&apos;ni ochish
          </a>
        )}

        {/* QR faqat katta ekranda: telefonda o'z ekranini skanerlab bo'lmaydi. */}
        {qr && (
          <div className="hidden sm:flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, optimallashtirish kerak emas */}
            <img
              src={qr}
              alt="Telegram'da kirishni tasdiqlash uchun QR-kod"
              width={120}
              height={120}
              className="rounded-lg bg-white p-1 shrink-0"
            />
            <p className="text-sm text-muted">Yoki telefon kamerasi bilan skanerlang — tasdiqdan so&apos;ng bu sahifa o&apos;zi kiradi.</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p role="status" className="flex items-center gap-2 text-sm text-muted">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
            {bosqich.tur === "kirilmoqda" ? "Kirilmoqda…" : `Tasdiq kutilmoqda · ${vaqtMatni(qolgan)}`}
          </p>
          {bosqich.tur === "kutilmoqda" && (
            <Button variant="ghost" size="sm" onClick={bekor}>
              Bekor qilish
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {bosqich.tur === "xato" && (
        <p role="alert" className={`text-sm ${bosqich.sabab === "boglanmagan" ? "text-muted" : "text-expense"}`}>
          {XATO_MATNI[bosqich.sabab]}
        </p>
      )}
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={boshla}
        loading={bosqich.tur === "yuklanmoqda"}
      >
        {bosqich.tur !== "yuklanmoqda" && <Send className="h-5 w-5 text-info" aria-hidden="true" />}
        {/* Matnda "kirish" so'zi ATAYLAB yo'q: brauzer testlari asosiy tugmani
            `getByRole("button", { name: "Kirish" })` (qisman moslik) bilan topadi. */}
        Telegram bilan davom etish
      </Button>
    </div>
  );
}
