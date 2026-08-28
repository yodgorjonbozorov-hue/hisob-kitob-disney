"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, KeyRound, Sparkles } from "lucide-react";
import { ROL_LABEL, type Rol } from "@/lib/auth/roles";
import { AI_HREF, guruhlanganNav, type NavItem } from "@/lib/modules/registry";
import { TelegramLinkButton } from "@/components/TelegramLinkButton";
import { BusinessSwitcher } from "@/components/BusinessSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { useNotifCount } from "./useNotifCount";
import { SidebarNav, SidebarLink } from "./SidebarNav";

interface BusinessOption { id: string; nomi: string }
interface Props {
  ism: string;
  rol: Rol;
  businesses: BusinessOption[];
  activeBusinessId: string | null;
  /** Modul registry'sidan generatsiya qilingan havolalar (lib/modules/registry.ts). */
  navItems: NavItem[];
}

export default function Sidebar({ ism, rol, businesses, activeBusinessId, navItems }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  // Badge soni sahifani bloklamasdan keyin yuklanadi.
  const notifCount = useNotifCount();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  /*
   * AI YORDAMCHI — ro'yxatdan AJRATILADI.
   *
   * Havolaning O'ZI registry'da qoladi (modul yoqilganligi va rol matritsasi
   * o'sha yerda hal qilinadi), shu bois bu yerda hech qanday yangi shart
   * YO'Q: element ro'yxatga tushgan bo'lsa — foydalanuvchining unga ruxsati
   * bor. U shunchaki oddiy qator o'rniga yuqorida ajralib turadigan tugma
   * bo'lib chiziladi va uzun menyudan bitta qator bo'shatadi.
   */
  const aiItem = navItems.find((n) => n.href === AI_HREF) ?? null;
  const bolimlar = guruhlanganNav(navItems.filter((n) => n.href !== AI_HREF));

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-line min-h-screen hidden lg:flex lg:flex-col">
      <div className="px-5 py-5 border-b border-line flex items-center">
        <Link href="/app" aria-label="Balansa — boshqaruv paneli">
          <Logo variant="full" height={30} />
        </Link>
      </div>
      <div className="px-3 pt-4">
        <p className="text-2xs text-faint px-1 mb-1.5 uppercase tracking-wide">Biznes</p>
        <BusinessSwitcher businesses={businesses} activeId={activeBusinessId} />
      </div>
      {aiItem && (
        <div className="px-3 pt-3">
          <Link
            href={aiItem.href}
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium border transition ${
              pathname === aiItem.href
                ? "bg-brand text-brand-fg border-transparent shadow-card"
                : "bg-brand-wash text-brand border-brand/30 hover:border-brand hover:shadow-card"
            }`}
          >
            <Sparkles className="w-[18px] h-[18px] shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="flex-1">{aiItem.label}</span>
          </Link>
        </div>
      )}
      <SidebarNav
        bolimlar={bolimlar}
        pathname={pathname}
        yuqori={
          <SidebarLink
            href="/app/bildirishnomalar"
            label="Bildirishnomalar"
            Icon={Bell}
            active={pathname === "/app/bildirishnomalar"}
            badge={notifCount}
          />
        }
      />
      <div className="px-4 py-4 border-t border-line space-y-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg truncate">{ism}</p>
            <p className="text-xs text-faint">{ROL_LABEL[rol]}</p>
          </div>
          <ThemeToggle />
        </div>
        <TelegramLinkButton className="flex items-center gap-2 text-xs text-muted hover:text-brand" />
        <Link href="/parol-ozgartirish" className="flex items-center gap-2 text-xs text-muted hover:text-brand">
          <KeyRound className="w-3.5 h-3.5" /> Parolni o'zgartirish
        </Link>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-expense hover:text-expense-fg">
          <LogOut className="w-4 h-4" /> Chiqish
        </button>
      </div>
    </aside>
  );
}
