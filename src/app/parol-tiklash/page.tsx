import { ParolTiklashForm } from "./ParolTiklashForm";
import { Logo } from "@/components/Logo";
import { BRAND_SIGNATURE } from "@/lib/brand";

/**
 * PAROLNI TIKLASH sahifasi (H-7): login → Telegram kodi → yangi parol.
 * Telegram ulanmagan foydalanuvchi uchun yo'l-yo'riq formaning o'zida.
 */
export default function ParolTiklashPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo variant="full" height={44} className="mb-4" />
          <p className="text-sm text-muted">Parolni tiklash</p>
        </div>
        <div className="bg-surface rounded-2xl shadow-card border border-line p-7">
          <ParolTiklashForm />
        </div>
        <p className="text-center text-sm text-muted mt-5">
          Esladingizmi?{" "}
          <a href="/login" className="text-brand font-medium hover:underline">
            Kirish sahifasiga qaytish
          </a>
        </p>
        <p className="text-center text-2xs text-faint mt-4">{BRAND_SIGNATURE}</p>
      </div>
    </div>
  );
}
