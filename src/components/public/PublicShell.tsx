import Link from "next/link";
import { cn } from "@/lib/cn";
import { BRAND, BRAND_SIGNATURE } from "@/lib/brand";
import { LinkButton } from "@/components/ui/LinkButton";
import { PublicHeader } from "./PublicHeader";

/**
 * Public sayt qobig'i — ilovadagi qobiq (`app/app/layout.tsx`) bilan bir xil
 * tuzilishda: yuqorida sticky panel, o'rtada kontent, telefonda pastda doimiy
 * amal paneli. Ilovadagi `main` da `pb-24 lg:pb-8` bo'lgani kabi bu yerda ham
 * pastki panel ostidagi kontent berkilib qolmaydi.
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

/**
 * Telefondagi doimiy amal paneli — ilovadagi tab-bar (`nav/BottomNav`) bilan
 * bir xil qatlam: `fixed bottom-0`, `bg-surface`, `border-t border-line`,
 * `pb-safe` (xavfsiz zona).
 */
function MobileCtaBar() {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line pb-safe">
      <div className="flex items-center gap-2 px-4 py-2.5">
        {/* Matn qisqa — 390px ekranda tugma ichida ikki qatorga sinmasin. */}
        <LinkButton href="/signup" size="lg" className="flex-[2]">
          Bepul boshlash
        </LinkButton>
        <LinkButton href="/login" size="lg" variant="secondary" className="flex-1">
          Kirish
        </LinkButton>
      </div>
    </div>
  );
}

export function PublicShell({
  children,
  cta = false,
}: {
  children: React.ReactNode;
  /** Telefonda pastki doimiy amal panelini ko'rsatish (landing uchun). */
  cta?: boolean;
}) {
  return (
    <div className={cn("min-h-screen flex flex-col bg-app", cta && "pb-20 lg:pb-0")}>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
      {cta && <MobileCtaBar />}
    </div>
  );
}
