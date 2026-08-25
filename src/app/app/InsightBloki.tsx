import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Insight } from "@/lib/services/dashboardInsight";

/** Ton bo'yicha nuqta rangi — matn rangi EMAS: xulosa o'qilishi ustuvor. */
const TON_RANG: Record<Insight["ton"], string> = {
  ijobiy: "bg-income",
  salbiy: "bg-expense",
  betaraf: "bg-brand",
};

/**
 * "BALANSA INSIGHT" — real raqamlardan chiqarilgan 2–4 xulosa.
 *
 * Matnni `lib/services/dashboardInsight.ts` hisoblaydi (deterministik,
 * AI chaqiruvisiz). Bu komponent faqat ko'rsatadi.
 *
 * "Batafsil tahlil" havolasi AI moduli YOQILGAN va rolga ochiq bo'lsagina
 * chiqadi — aks holda foydalanuvchi kira olmaydigan sahifaga taklif
 * qilingan bo'lardi.
 */
export function InsightBloki({
  insightlar,
  aiHavolasi,
}: {
  insightlar: Insight[];
  aiHavolasi: boolean;
}) {
  return (
    <Card className="h-full flex flex-col">
      <h2 className="font-semibold text-fg flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-brand" aria-hidden />
        Balansa Insight
      </h2>

      {insightlar.length === 0 ? (
        <p className="text-sm text-muted mt-4 flex-1">
          Xulosa chiqarish uchun yozuv yetarli emas. Kirim va chiqim kiritilgach bu
          yerda tahlil paydo bo&apos;ladi.
        </p>
      ) : (
        <ul className="mt-4 space-y-3 flex-1">
          {insightlar.map((i) => (
            <li key={i.kod} className="flex gap-2.5 text-sm text-fg leading-snug">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${TON_RANG[i.ton]}`} aria-hidden />
              <span>{i.matn}</span>
            </li>
          ))}
        </ul>
      )}

      {aiHavolasi && (
        <Link
          href="/app/ai"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          Batafsil tahlil →
        </Link>
      )}
    </Card>
  );
}
