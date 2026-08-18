import Link from "next/link";
import { BRAND, BRAND_SIGNATURE } from "@/lib/brand";
import { PublicHeader } from "./PublicHeader";

/**
 * Public sayt qobig'i — ilovadagi qobiq (`app/app/layout.tsx`) bilan bir xil
 * tuzilishda: yuqorida sticky panel, o'rtada kontent, pastda footer.
 *
 * Bosh sahifa bu qobiqdan FOYDALANMAYDI: uning o'z qorong'i paneli va
 * footeri bor (`components/landing/`). Bu yerda kirish, ro'yxatdan o'tish va
 * maxfiylik sahifalari qoladi.
 */

function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-faint space-y-1.5">
        <p>
          {BRAND_SIGNATURE} · {BRAND.tagline}
        </p>
        <p className="flex items-center justify-center gap-3">
          <Link href="/login" className="hover:text-fg transition">
            Kirish
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/signup" className="hover:text-fg transition">
            Ro&apos;yxatdan o&apos;tish
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/maxfiylik" className="hover:text-fg transition">
            Maxfiylik
          </Link>
        </p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-app">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
