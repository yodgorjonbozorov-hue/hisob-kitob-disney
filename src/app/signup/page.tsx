import Link from "next/link";
import SignupForm from "./SignupForm";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Ro'yxatdan o'tish — ${BRAND.nomi}`,
};

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo variant="full" height={40} className="mb-4" />
          <h1 className="font-heading text-2xl font-semibold text-fg">Ro'yxatdan o'tish</h1>
          <p className="text-sm text-faint mt-2">
            Biznesingiz uchun {BRAND.nomi} — <span className="font-medium text-fg">14 kun bepul</span>
          </p>
        </div>
        <div className="bg-surface rounded-2xl shadow-card border border-line p-7">
          <SignupForm />
        </div>
        <p className="text-center text-sm text-muted mt-5">
          Allaqachon hisobingiz bormi?{" "}
          <Link href="/login" className="text-brand font-medium hover:underline">
            Kirish
          </Link>
        </p>
      </div>
    </div>
  );
}
