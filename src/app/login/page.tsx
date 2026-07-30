import LoginForm from "./LoginForm";
import { Logo } from "@/components/Logo";
import { BRAND, BRAND_SIGNATURE, ESKI_NOM_IZOHI } from "@/lib/brand";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo variant="full" height={44} className="mb-4" />
          <p className="text-sm text-muted">{BRAND.tagline}</p>
          <p className="text-2xs text-faint mt-2">{ESKI_NOM_IZOHI}</p>
        </div>
        <div className="bg-surface rounded-2xl shadow-card border border-line p-7">
          <LoginForm />
        </div>
        <p className="text-center text-sm text-muted mt-5">
          Yangi kompaniyamisiz?{" "}
          <a href="/signup" className="text-brand font-medium hover:underline">
            14 kun bepul sinab ko'ring
          </a>
        </p>
        <p className="text-center text-2xs text-faint mt-4">{BRAND_SIGNATURE}</p>
      </div>
    </div>
  );
}
