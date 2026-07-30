import Link from "next/link";
import DemoForm from "./DemoForm";
import { DisneyLogo } from "@/components/DisneyLogo";
import { TRIAL_KUNLARI } from "@/lib/billing/constants";

export const metadata = {
  title: "Demo so'rash — Hisob-Kitob",
};

export default function DemoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <DisneyLogo className="w-16 h-20 text-fg mb-4" />
          <h1 className="text-2xl font-semibold text-fg">Demo so'rash</h1>
          <p className="text-sm text-faint mt-2">
            Tizimni ko'rsatamiz va akkauntingizni o'zimiz sozlaymiz —{" "}
            <span className="font-medium text-fg">{TRIAL_KUNLARI} kun sizga bepul</span>
          </p>
        </div>
        <div className="bg-surface rounded-2xl shadow-card border border-line p-7">
          <DemoForm />
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
