import { Logo } from "@/components/Logo";

/**
 * Internet uzilganda service worker ko'rsatadigan sahifa (public/sw.js).
 * Statik — hech qanday ma'lumot so'ramaydi.
 */
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo variant="icon" height={48} />
      <h1 className="text-xl font-bold text-fg">Internet aloqasi yo&apos;q</h1>
      <p className="text-sm text-muted max-w-xs">
        Balansa ishlashi uchun internet kerak. Aloqa tiklangach sahifa o&apos;zi
        ochiladi yoki qayta urinib ko&apos;ring.
      </p>
      <a
        href="/app"
        className="mt-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium"
      >
        Qayta urinish
      </a>
    </div>
  );
}
