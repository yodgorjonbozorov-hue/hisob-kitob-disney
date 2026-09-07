import Link from "next/link";
import { Card } from "@/components/ui/Card";

/**
 * DEMO YO'LLANMASI — mehmon 3-5 daqiqada Balansa qiymatini ko'rishi uchun
 * qisqa marshrut. Tartib ATAYLAB shunday: pul kirdi (savdo) → qayerga ketdi
 * (kirim/chiqim) → nima qoldi (sof foyda) → kimda qoldi (qarzdorlik) →
 * qayerda turibdi (ombor/kassa).
 *
 * Faqat demo rejimida ko'rinadi; haqiqiy mijozning dashboardi o'zgarmaydi.
 */
const QADAMLAR: { label: string; izoh: string; href: string }[] = [
  { label: "Savdo", izoh: "Bugungi va oylik sotuvlar", href: "/app/sotuv" },
  { label: "Kirim va chiqim", izoh: "Har so'm qayerdan kelib, qayerga ketdi", href: "/app/tranzaksiyalar" },
  { label: "Sof foyda", izoh: "Oylik hisobot va kategoriyalar kesimi", href: "/app/hisobot" },
  { label: "Qarzdorlik", izoh: "Kim qancha qarzdor va muddati qachon", href: "/app/qarzlar" },
  { label: "Ombor va kassa", izoh: "Qoldiq va kassadagi pul", href: "/app/ombor" },
];

export function DemoYollanma() {
  return (
    <Card className="border-brand/40">
      <h2 className="font-heading font-semibold text-fg">Demoda nimadan boshlash</h2>
      <p className="mt-1 text-sm text-muted">
        Beshta ekran — biznesning to&apos;liq moliyaviy manzarasi.
      </p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {QADAMLAR.map((q, i) => (
          <li key={q.href}>
            <Link
              href={q.href}
              className="flex items-start gap-2.5 rounded-lg border border-line p-3 hover:border-brand hover:bg-brand-wash/40 transition"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-wash text-2xs font-semibold text-brand">
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-fg">{q.label}</span>
                <span className="block text-xs text-muted">{q.izoh}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
