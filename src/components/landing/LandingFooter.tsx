import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ALOQA, BRAND } from "@/lib/brand";

const HAVOLALAR = [
  { href: "#imkoniyatlar", matn: "Imkoniyatlar" },
  { href: "#narx", matn: "Narx" },
  { href: "/login", matn: "Kirish" },
  { href: "/maxfiylik", matn: "Maxfiylik siyosati" },
];

/** Landing pastki qismi — hero bilan bir xil qorong'i fonda (mavzudan qat'i nazar). */
export function LandingFooter() {
  return (
    <footer className="border-t border-[#223E3B] bg-[#061413] px-10 py-16 max-[900px]:px-5">
      <div className="mx-auto flex max-w-[1200px] justify-between gap-12 max-[900px]:flex-col max-[900px]:gap-6">
        <div>
          <Logo variant="full" inverted height={24} />
          <p className="m-0 mt-3 text-[14px] text-[#E2F0EE]/50">{BRAND.tagline}</p>
        </div>

        <div className="flex flex-col gap-2.5 text-[14px]">
          {HAVOLALAR.map((h) =>
            h.href.startsWith("#") ? (
              <a key={h.href} href={h.href} className="text-[#E2F0EE]/[0.62] hover:text-[#F8FBFA]">
                {h.matn}
              </a>
            ) : (
              <Link key={h.href} href={h.href} className="text-[#E2F0EE]/[0.62] hover:text-[#F8FBFA]">
                {h.matn}
              </Link>
            ),
          )}
        </div>

        <div className="flex flex-col gap-2.5 text-[14px] text-[#E2F0EE]/[0.62]">
          <span>Telegram: {ALOQA.telegram}</span>
          {ALOQA.telefon && <span>{ALOQA.telefon}</span>}
        </div>

        <div className="text-[13px] text-[#E2F0EE]/[0.38]">
          <p className="m-0">
            © {new Date().getFullYear()} {BRAND.nomi}
          </p>
          <p className="m-0 mt-1.5">{BRAND.domen}</p>
        </div>
      </div>
    </footer>
  );
}
