import Link from "next/link";
import LoginForm from "./LoginForm";
import { AuthShell } from "@/components/public/AuthShell";
import { BRAND, ESKI_NOM_IZOHI } from "@/lib/brand";

export const metadata = {
  title: `Kirish — ${BRAND.nomi}`,
};

export default function LoginPage() {
  return (
    <AuthShell
      joriy="login"
      sarlavha="Kirish"
      tavsif={
        <>
          {BRAND.tagline}
          <span className="block text-2xs text-faint mt-1">{ESKI_NOM_IZOHI}</span>
        </>
      }
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
    </AuthShell>
  );
}
