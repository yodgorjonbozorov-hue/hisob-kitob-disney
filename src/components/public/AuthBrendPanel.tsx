import { BarChart3, Boxes, Send, Wallet } from "lucide-react";
import { BRAND } from "@/lib/brand";

/**
 * Kirish/ro'yxat sahifasining brend paneli — FAQAT katta ekranda (lg+).
 *
 * Fon `brand-900` + `brand-700` — mavzudan qat'i nazar bir xil brend shkalasi
 * (docs/BRAND.md), shuning uchun matn doim oq. Semantik moliyaviy ranglar
 * (yashil/qizil) bu yerda ATAYLAB ishlatilmaydi: ular pul harakatini bildiradi.
 */
const AFZALLIKLAR = [
  { ikon: Wallet, matn: "Kirim-chiqim, kassa va qarzlar bitta joyda" },
  { ikon: Boxes, matn: "Ombor, sotuv va mijozlar nazoratda" },
  { ikon: BarChart3, matn: "Oy oxirida hisobot — avtomatik" },
  { ikon: Send, matn: "Telegram bot orqali yozish va kirish" },
] as const;

export function AuthBrendPanel() {
  return (
    <aside
      aria-label={`${BRAND.nomi} haqida`}
      className="hidden lg:flex flex-col justify-between rounded-2xl p-10 min-h-[480px] text-white bg-gradient-to-br from-brand-900 to-brand-700 shadow-sm"
    >
      <div>
        <p className="text-sm font-medium text-brand-200">{BRAND.domen}</p>
        <p className="font-heading text-3xl font-semibold leading-tight mt-3">{BRAND.tagline}</p>
        <p className="text-brand-100/90 mt-3 text-sm leading-relaxed">{BRAND.tavsif}</p>
      </div>
      <ul className="space-y-4 mt-10">
        {AFZALLIKLAR.map(({ ikon: Ikon, matn }) => (
          <li key={matn} className="flex items-center gap-3 text-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Ikon className="h-5 w-5 text-brand-200" aria-hidden="true" />
            </span>
            {matn}
          </li>
        ))}
      </ul>
    </aside>
  );
}
