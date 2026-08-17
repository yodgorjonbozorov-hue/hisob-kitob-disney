import Link from "next/link";
import SignupForm from "./SignupForm";
import { AuthShell } from "@/components/public/AuthShell";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `Ro'yxatdan o'tish — ${BRAND.nomi}`,
};

export default function SignupPage() {
  return (
    <AuthShell
      joriy="signup"
      sarlavha="Ro'yxatdan o'tish"
      tavsif={
        <>
          Biznesingiz uchun {BRAND.nomi} — <span className="font-medium text-fg">14 kun bepul</span>
        </>
      }
      ost={
        <>
          Allaqachon hisobingiz bormi?{" "}
          <Link href="/login" className="text-brand font-medium hover:underline">
            Kirish
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
