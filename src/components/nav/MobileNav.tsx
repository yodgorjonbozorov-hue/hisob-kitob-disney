"use client";

import Link from "next/link";
import type { Rol } from "@/lib/auth/session";
import { BusinessSwitcher } from "@/components/BusinessSwitcher";
import { DisneyLogo } from "@/components/DisneyLogo";

interface BusinessOption {
  id: string;
  nomi: string;
}

interface Props {
  ism: string;
  rol: Rol;
  businesses: BusinessOption[];
  activeBusinessId: string | null;
  omborli: boolean;
  notifCount: number;
}

/**
 * Mobil yuqori panel (top app bar): brend + biznes almashtirgich + qo'ng'iroq.
 * Navigatsiya pastki tab-bar (BottomNav) orqali. Faqat < lg.
 */
export default function MobileNav({ rol, businesses, activeBusinessId, notifCount }: Props) {
  return (
    <div className="lg:hidden sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-line">
      <div className="flex items-center justify-between px-4 py-2.5 gap-2">
        <span className="flex items-center gap-1.5 shrink-0">
          <DisneyLogo className="w-5 h-6 text-fg" />
          <span className="font-semibold tracking-[0.12em] text-fg text-sm" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            DISNEY
          </span>
        </span>
        <div className="flex-1 min-w-0">
          <BusinessSwitcher businesses={businesses} activeId={activeBusinessId} rol={rol} />
        </div>
        <Link href="/app/bildirishnomalar" aria-label="Bildirishnomalar" className="relative shrink-0 w-9 h-9 flex items-center justify-center text-muted">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {notifCount > 0 && (
            <span className="absolute top-0.5 right-0.5 bg-expense text-white text-[10px] font-semibold rounded-full min-w-[16px] h-[16px] px-0.5 flex items-center justify-center">
              {notifCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
