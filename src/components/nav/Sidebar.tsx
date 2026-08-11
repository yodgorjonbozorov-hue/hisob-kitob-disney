"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Receipt, FileText, PiggyBank, Bell, CalendarCheck, Repeat, Wallet,
  Package, ShoppingCart, HandCoins, Truck, Factory, Building2, Tags, Users, Trash2, ScrollText,
  BadgeCheck, Gavel, Contact2, IdCard, CalendarDays, FileSignature, ClipboardList,
  LogOut, KeyRound, CreditCard, Blocks, Handshake, BookUser, ListChecks, Sparkles, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ROL_LABEL, type Rol } from "@/lib/auth/roles";
import type { NavItem } from "@/lib/modules/registry";
import { TelegramLinkButton } from "@/components/TelegramLinkButton";
import { BusinessSwitcher } from "@/components/BusinessSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { useNotifCount } from "./useNotifCount";

interface BusinessOption { id: string; nomi: string }
interface Props {
  ism: string;
  rol: Rol;
  businesses: BusinessOption[];
  activeBusinessId: string | null;
  /** Modul registry'sidan generatsiya qilingan havolalar (lib/modules/registry.ts). */
  navItems: NavItem[];
}

/** Registry'dagi ikon kaliti -> lucide komponenti. */
const IKONLAR: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  receipt: Receipt,
  report: FileText,
  budget: PiggyBank,
  wallet: Wallet,
  purchase: Truck,
  supplier: Factory,
  approval: BadgeCheck,
  rule: Gavel,
  customers: Contact2,
  hr: IdCard,
  attendance: CalendarDays,
  contract: FileSignature,
  repeat: Repeat,
  shift: CalendarCheck,
  daily: ClipboardList,
  package: Package,
  cart: ShoppingCart,
  debt: HandCoins,
  business: Building2,
  tags: Tags,
  users: Users,
  trash: Trash2,
  audit: ScrollText,
  modules: Blocks,
  billing: CreditCard,
  crm: Handshake,
  contacts: BookUser,
  tasks: ListChecks,
  ai: Sparkles,
};

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

  const item = (href: string, label: string, Icon: LucideIcon, badge?: number) => {
    const active = pathname === href;
    return (
      <Link
        key={href + label}
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
          active ? "bg-brand-wash text-brand font-medium" : "text-muted hover:bg-surface-2 hover:text-fg"
        )}
      >
        <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.25 : 2} />
        <span className="flex-1">{label}</span>
        {badge ? (
          <span className="bg-expense text-white text-2xs font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center tnum">
            {badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside className="w-64 shrink-0 bg-surface border-r border-line min-h-screen hidden lg:flex lg:flex-col">
      <div className="px-5 py-5 border-b border-line flex items-center">
        <Link href="/app" aria-label="Balansa — boshqaruv paneli">
          <Logo variant="full" height={30} />
        </Link>
      </div>
      <div className="px-3 pt-4">
        <p className="text-2xs text-faint px-1 mb-1.5 uppercase tracking-wide">Biznes</p>
        <BusinessSwitcher businesses={businesses} activeId={activeBusinessId} rol={rol} />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {item("/app/bildirishnomalar", "Bildirishnomalar", Bell, notifCount)}
        {navItems.map((l) => item(l.href, l.label, IKONLAR[l.icon] ?? Receipt))}
      </nav>
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
