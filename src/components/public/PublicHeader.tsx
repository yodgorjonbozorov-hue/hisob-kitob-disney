import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LinkButton } from "@/components/ui/LinkButton";
import { BRAND } from "@/lib/brand";

/**
 * Public sahifalarning yuqori paneli.
 *
 * Ilovadagi mobil panel (`nav/MobileNav`) bilan AYNI tarzda qurilgan: sticky,
 * `bg-surface/90 backdrop-blur`, pastida `border-b border-line`, balandligi
 * 56px — ya'ni pastki tab-bar (`h-14`) bilan bir xil. Foydalanuvchi saytdan
 * ilovaga o'tganda panel "sakramaydi".
 */
export function PublicHeader({
  joriy,
  logoToliq = false,
}: {
  /** Ochiq turgan sahifa — o'ziga o'zi havola ko'rsatilmaydi. */
  joriy?: "login" | "signup";
  /** Telefonda ham to'liq logotip (kirish/ro'yxat ekranlarida brend ko'rinsin). */
  logoToliq?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label={`${BRAND.nomi} — bosh sahifa`}
          className="shrink-0 flex items-center"
        >
          <Logo variant="full" height={26} className={logoToliq ? "" : "hidden sm:block"} />
          {!logoToliq && <Logo variant="icon" height={26} className="sm:hidden" />}
        </Link>
        <nav className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/tariflar"
            className="hidden sm:inline-flex items-center min-h-[44px] px-3 rounded-lg text-sm text-muted hover:text-fg hover:bg-surface-2 transition"
          >
            Tariflar
          </Link>
          {joriy !== "login" && (
            <Link
              href="/login"
              className="inline-flex items-center min-h-[44px] px-3 rounded-lg text-sm text-muted hover:text-fg hover:bg-surface-2 transition"
            >
              Kirish
            </Link>
          )}
          {joriy !== "signup" && (
            <LinkButton href="/signup" className="hidden sm:inline-flex">
              Bepul sinab ko&apos;rish
            </LinkButton>
          )}
        </nav>
      </div>
    </header>
  );
}
