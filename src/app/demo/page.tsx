import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AuthShell } from "@/components/public/AuthShell";
import { BRAND } from "@/lib/brand";
import { DEMO_BUSINESS_NOMI } from "@/lib/auth/demo";
import { DemoBoshlash } from "./DemoBoshlash";

export const metadata = {
  title: `Demo — ${BRAND.nomi}`,
  description:
    "Ro'yxatdan o'tmasdan Balansa ichini ko'ring: namunaviy biznes, tayyor savdo, " +
    "kirim-chiqim, ombor va qarzdorlik ma'lumotlari bilan.",
};

/** Demo'da mehmon birinchi navbatda ko'radigan qiymatlar (dashboard tartibi bilan bir xil). */
const KORSATILADI = [
  "Bugungi va oylik savdo",
  "Kirim va chiqim",
  "Sof foyda",
  "Qarzdorlik",
  "Ombor va kassa qoldig'i",
];

/**
 * DEMO KIRISH SAHIFASI.
 *
 * V1 da tanlov yo'q — bitta universal demo biznes ("Balansa Demo").
 * Biznes turlari bo'yicha demo (avto/xizmat) keyingi bosqichda.
 */
export default async function DemoPage() {
  const session = await getSession();
  // Tizimga kirgan foydalanuvchining sessiyasi demo tufayli BUZILMAYDI —
  // u shunchaki o'z ilovasiga qaytariladi.
  if (session.userId) {
    redirect(session.rol === "SUPERADMIN" ? "/superadmin" : "/app");
  }

  return (
    <AuthShell
      sarlavha="Demo rejimi"
      tavsif={
        <>
          Ro&apos;yxatdan o&apos;tmasdan{" "}
          <span className="font-medium text-fg">{DEMO_BUSINESS_NOMI}</span> namunaviy biznesi
          orqali tizimni ko&apos;ring
        </>
      }
      ost={
        <>
          Tayyor bo&apos;lsangiz —{" "}
          <Link href="/signup?manba=demo" className="text-brand font-medium hover:underline">
            14 kun bepul boshlash
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <ul className="space-y-2">
          {KORSATILADI.map((q, i) => (
            <li key={q} className="flex items-start gap-2.5 text-sm text-fg">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-wash text-2xs font-semibold text-brand">
                {i + 1}
              </span>
              {q}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Ma&apos;lumotlar namunaviy va faqat ko&apos;rish uchun: demo rejimida hech narsa
          saqlanmaydi va o&apos;zgartirilmaydi.
        </p>
        <DemoBoshlash />
      </div>
    </AuthShell>
  );
}
