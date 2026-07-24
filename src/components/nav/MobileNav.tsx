"use client";

import type { Rol } from "@/lib/auth/session";
import { BusinessSwitcher } from "@/components/BusinessSwitcher";

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
}

/**
 * Mobil yuqori panel (top app bar): brend + biznes almashtirgich.
 * Navigatsiya pastki tab-bar (BottomNav) orqali. Faqat < lg.
 */
export default function MobileNav({ rol, businesses, activeBusinessId }: Props) {
  return (
    <div className="lg:hidden sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-line">
      <div className="flex items-center justify-between px-4 py-2.5 gap-3">
        <span className="font-semibold shrink-0 text-fg">Hisob-Kitob</span>
        <div className="flex-1 min-w-0 max-w-[60%]">
          <BusinessSwitcher businesses={businesses} activeId={activeBusinessId} rol={rol} />
        </div>
      </div>
    </div>
  );
}
