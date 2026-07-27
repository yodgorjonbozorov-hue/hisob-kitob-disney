import Link from "next/link";
import SignupForm from "./SignupForm";
import { DisneyLogo } from "@/components/DisneyLogo";

export const metadata = {
  title: "Ro'yxatdan o'tish — Kirim-Chiqim tizimi",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <DisneyLogo className="w-16 h-20 text-fg mb-4" />
          <h1 className="text-2xl font-semibold text-fg">Ro'yxatdan o'tish</h1>
          <p className="text-sm text-faint mt-2">
            Kompaniyangiz uchun kirim-chiqim tizimi — <span className="font-medium text-fg">14 kun bepul</span>
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
