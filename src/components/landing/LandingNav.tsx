"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Bo'lim havolalari — dizayndagi tartib. */
const HAVOLALAR = [
  { href: "#imkoniyatlar", matn: "Imkoniyatlar" },
  { href: "#kunlik", matn: "Kunlik hisobot" },
  { href: "#narx", matn: "Narx" },
  { href: "#savollar", matn: "Savollar" },
] as const;

/**
 * Landing yuqori paneli. Hero qorong'i bo'lgani uchun panel HAR DOIM qorong'i
 * fon uchun bo'yaladi (mavzudan qat'i nazar) — sahifa ustidan suzib boradi.
 *
 * Sahifa 24px dan pastga siljisa panel shaffofdan shishasimon (blur) holatga
 * o'tadi — dizayndagi `_onScroll` bilan bir xil chegara.
 */
export function LandingNav() {
  const [qotgan, setQotgan] = useState(false);
  const [menyu, setMenyu] = useState(false);

  useEffect(() => {
    const kuzat = () => setQotgan(window.scrollY > 24);
    kuzat();
    window.addEventListener("scroll", kuzat, { passive: true });
    return () => window.removeEventListener("scroll", kuzat);
  }, []);

  // Menyu ochiq turganda orqa fon sirg'anmaydi va Esc bilan yopiladi.
  useEffect(() => {
    if (!menyu) return;
    const oldingi = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tugma = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenyu(false);
    };
    window.addEventListener("keydown", tugma);
    return () => {
      document.body.style.overflow = oldingi;
      window.removeEventListener("keydown", tugma);
    };
  }, [menyu]);

  return (
    <>
      <nav
        className={`sticky top-0 z-[60] border-b px-10 transition-[background-color,border-color,backdrop-filter] duration-200 max-[900px]:px-5 ${
          qotgan
            ? "border-[#5EEAD4]/[0.12] bg-[#061413]/[0.72] backdrop-blur-[12px]"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between">
          <Link href="/" aria-label="Balansa — bosh sahifa" className="flex shrink-0 items-center">
            <Logo variant="full" inverted height={26} />
          </Link>

          <div className="flex gap-8 text-[15px] max-[900px]:hidden">
            {HAVOLALAR.map((h) => (
              <a key={h.href} href={h.href} className="text-[#F8FBFA]/[0.72] hover:text-[#F8FBFA]">
                {h.matn}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-5 max-[900px]:hidden">
            <Link href="/login" className="text-[15px] text-[#F8FBFA]/[0.72] hover:text-[#F8FBFA]">
              Kirish
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[#5EEAD4] px-[18px] py-2.5 text-[15px] font-semibold text-[#061413] hover:bg-[#99F6E4]"
            >
              Bepul boshlash
            </Link>
          </div>

          <button
            type="button"
            aria-label="Menyu"
            aria-expanded={menyu}
            onClick={() => setMenyu(true)}
            className="hidden h-[42px] w-[42px] items-center justify-center rounded-[12px] border border-[#F8FBFA]/[0.28] max-[900px]:flex"
          >
            <span
              aria-hidden="true"
              className="block h-[1.5px] w-4 bg-[#F8FBFA] shadow-[0_-5px_0_#F8FBFA,0_5px_0_#F8FBFA]"
            />
          </button>
        </div>
      </nav>

      {menyu && <MobilMenyu yop={() => setMenyu(false)} />}
    </>
  );
}

/** Telefondagi to'liq ekran menyu — dizayndagi `menuOpen` qatlami. */
function MobilMenyu({ yop }: { yop: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#061413] px-5 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <Logo variant="full" inverted height={26} />
        <button
          type="button"
          aria-label="Yopish"
          onClick={yop}
          className="h-[42px] w-[42px] rounded-[12px] border border-[#F8FBFA]/[0.28] text-[18px] text-[#F8FBFA]"
        >
          ×
        </button>
      </div>

      <div className="mt-12 flex flex-col gap-1">
        {HAVOLALAR.map((h) => (
          <a
            key={h.href}
            href={h.href}
            onClick={yop}
            className="border-b border-[#223E3B] py-3.5 font-heading text-[26px] font-semibold text-[#F8FBFA]"
          >
            {h.matn}
          </a>
        ))}
        <Link href="/login" onClick={yop} className="py-3.5 text-[17px] text-[#F8FBFA]/[0.72]">
          Kirish
        </Link>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <Link
          href="/signup"
          onClick={yop}
          className="rounded-[16px] bg-[#5EEAD4] p-[18px] text-center text-[17px] font-semibold text-[#061413]"
        >
          Bepul boshlash
        </Link>
        <p className="m-0 text-center text-[13px] text-[#F8FBFA]/50">
          14 kun bepul · Karta talab qilinmaydi
        </p>
      </div>
    </div>
  );
}
