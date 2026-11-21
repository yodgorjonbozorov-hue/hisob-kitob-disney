import Link from "next/link";
import LoginForm from "./LoginForm";
import { TelegramKirish } from "./TelegramKirish";
import { AuthShell } from "@/components/public/AuthShell";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Kirish — ${BRAND.nomi}`,
};

export default function LoginPage() {
  return (
    <AuthShell
      joriy="login"
      sarlavha="Xush kelibsiz"
      tavsif={`${BRAND.nomi} hisobingizga kiring`}
      ost={
        <>
          Yangi kompaniyamisiz?{" "}
          <Link href="/signup" className="text-brand font-medium hover:underline">
            14 kun bepul sinab ko&apos;ring
          </Link>
        </>
      }
    >
      <LoginForm />
      {/* Ajratgich: chiziq bilan "yoki" — ikki mustaqil kirish yo'li. */}
      <div className="flex items-center gap-3 my-5" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-faint">yoki</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <TelegramKirish />
    </AuthShell>
  );
}
