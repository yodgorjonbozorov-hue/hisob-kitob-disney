import { WifiOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LinkButton } from "@/components/ui/LinkButton";
import { BRAND } from "@/lib/brand";

/**
 * Internet uzilganda service worker ko'rsatadigan sahifa (public/sw.js).
 * Statik — hech qanday ma'lumot so'ramaydi.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 pb-safe text-center bg-app">
      <Logo variant="icon" height={40} />
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-2 text-muted">
        <WifiOff className="w-7 h-7" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h1 className="font-heading text-lg font-semibold text-fg">Internet aloqasi yo&apos;q</h1>
      <p className="text-sm text-muted max-w-xs">
        {BRAND.nomi} ishlashi uchun internet kerak. Aloqa tiklangach sahifa o&apos;zi
        ochiladi yoki qayta urinib ko&apos;ring.
      </p>
      <LinkButton href="/app" size="lg" className="mt-2">
        Qayta urinish
      </LinkButton>
    </div>
  );
}
