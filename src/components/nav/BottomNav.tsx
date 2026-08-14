"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ROL_LABEL, type Rol } from "@/lib/auth/roles";
import type { MobileTab } from "@/lib/modules/registry";
import { QuickAddSheet } from "./QuickAddSheet";
import { TelegramLinkButton } from "@/components/TelegramLinkButton";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  ism: string;
  rol: Rol;
  /** Registry'dan hisoblangan pastki tablar (computeMobileTabs). */
  tabs: MobileTab[];
  /** Menyu sheet'idagi barcha havolalar (registry nav'idan). */
  menyu: { label: string; href: string }[];
}


const ICONS: Record<string, React.ReactNode> = {
  home: (
    <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
  ),
  list: (
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  ),
  cart: (
    <path d="M6 6h15l-1.5 9h-12L6 6zM6 6 5 3H3m3 17a1 1 0 100 2 1 1 0 000-2zm11 0a1 1 0 100 2 1 1 0 000-2z" />
  ),
  chart: (
    <path d="M3 3v18h18M8 14v3M13 10v7M18 6v11" />
  ),
  daily: (
    <path d="M9 3h6v4H9zM9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 12h6M9 16h4" />
  ),
  menu: (
    <path d="M4 6h16M4 12h16M4 18h16" />
  ),
};

function TabIcon({ name }: { name: string }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/**
 * Mobil pastki tab-bar. Markazda ko'tarilgan FAB (tez qo'shish).
 * Faqat < lg — desktop'da yon menyu (Sidebar) ishlatiladi.
 */
export function BottomNav({ ism, rol, tabs, menyu }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [quickOpen, setQuickOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const mid = Math.ceil(tabs.length / 2);
  const left = tabs.slice(0, mid);
  const right = tabs.slice(mid);

  // Menyu sheet: bildirishnomalar + registry'dan kelgan havolalar.
  const allLinks: { label: string; href: string }[] = [
    { label: "🔔 Bildirishnomalar", href: "/app/bildirishnomalar" },
    ...menyu,
  ];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const TabLink = ({ label, href, icon }: { label: string; href: string; icon: string }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[52px] text-2xs ${
          active ? "text-brand" : "text-muted"
        }`}
      >
        <TabIcon name={icon} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Pastki tab-bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-safe">
        <div className="flex items-stretch h-14 relative">
          <div className="flex flex-1">
            {left.map((t) => (
              <TabLink key={t.href} {...t} />
            ))}
          </div>

          {/* Markaziy FAB */}
          <div className="w-16 flex items-start justify-center">
            <button
              onClick={() => setQuickOpen(true)}
              aria-label="Tez qo'shish"
              className="-mt-5 w-14 h-14 rounded-full bg-brand text-white shadow-lg flex items-center justify-center active:scale-95 transition"
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          <div className="flex flex-1">
            {right.map((t) => (
              <TabLink key={t.href} {...t} />
            ))}
            <button
              onClick={() => setMenuOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[52px] text-2xs ${
                menuOpen ? "text-brand" : "text-muted"
              }`}
              aria-label="Menyu"
            >
              <TabIcon name="menu" />
              <span>Menyu</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Menyu sheet */}
      {menuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex items-end bg-black/50 animate-fade-in"
          onClick={() => setMenuOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface text-fg w-full rounded-t-2xl p-5 pb-safe max-h-[85vh] overflow-y-auto animate-slide-up"
          >
            <div className="w-10 h-1 rounded-full bg-line mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium">{ism}</p>
                <p className="text-xs text-muted">{ROL_LABEL[rol]}</p>
              </div>
              <ThemeToggle />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {allLinks.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className={`rounded-lg px-3 py-3 text-sm font-medium border ${
                      active ? "bg-brand text-white border-transparent" : "bg-surface-2 text-fg border-line"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
            <TelegramLinkButton className="block text-sm text-muted mb-3" />
            <Link
              href="/parol-ozgartirish"
              onClick={() => setMenuOpen(false)}
              className="block text-sm text-muted mb-3"
            >
              Parolni o'zgartirish
            </Link>
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-lg bg-expense-soft text-expense-fg text-sm font-medium min-h-[44px]"
            >
              Chiqish
            </button>
          </div>
        </div>
      )}

      <QuickAddSheet open={quickOpen} onClose={() => setQuickOpen(false)} rol={rol} />
    </>
  );
}
