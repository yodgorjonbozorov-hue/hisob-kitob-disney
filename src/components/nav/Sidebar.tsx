"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Rol } from "@/lib/auth/session";
import { TelegramLinkButton } from "@/components/TelegramLinkButton";
import { BusinessSwitcher } from "@/components/BusinessSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

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

const adminOnlyBaseLinks = [
  { href: "/", label: "Boshqaruv paneli" },
  { href: "/tranzaksiyalar", label: "Tranzaksiyalar" },
  { href: "/hisobot", label: "Oylik hisobot" },
];

const kassirLinks = [{ href: "/tranzaksiyalar", label: "Tranzaksiyalar" }];

const adminLinks = [
  { href: "/admin/bizneslar", label: "Bizneslar" },
  { href: "/admin/kategoriyalar", label: "Kategoriyalar" },
  { href: "/admin/foydalanuvchilar", label: "Foydalanuvchilar" },
];

// Ombor moduli havolalari (aktiv biznes omborli bo'lsa).
const omborAdminLinks = [
  { href: "/ombor", label: "Ombor" },
  { href: "/sotuv", label: "Sotuv" },
  { href: "/qarzlar", label: "Qarzlar" },
];
const omborKassirLinks = [
  { href: "/sotuv", label: "Sotuv" },
  { href: "/qarzlar", label: "Qarzlar" },
];

const ROL_LABEL: Record<Rol, string> = {
  admin: "Direktor",
  kassir: "Kassir",
  sotuvchi: "Sotuvchi",
};

export default function Sidebar({ ism, rol, businesses, activeBusinessId, omborli }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const omborLinks = omborli ? (rol === "admin" ? omborAdminLinks : omborKassirLinks) : [];
  const links =
    rol === "admin"
      ? [...adminOnlyBaseLinks, ...omborLinks, ...adminLinks]
      : [...omborLinks, ...kassirLinks];

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 min-h-screen hidden lg:flex lg:flex-col">
      <div className="px-6 py-6 border-b border-slate-800">
        <h1 className="font-bold text-lg">Hisob-Kitob</h1>
        <p className="text-slate-400 text-xs mt-0.5">Kirim-Chiqim Tizimi</p>
      </div>
      <div className="px-3 pt-4">
        <p className="text-xs text-slate-500 px-1 mb-1">Biznes</p>
        <BusinessSwitcher businesses={businesses} activeId={activeBusinessId} rol={rol} />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{ism}</p>
            <p className="text-xs text-slate-400">{ROL_LABEL[rol]}</p>
          </div>
          <ThemeToggle className="text-slate-400 hover:text-white hover:bg-slate-800" />
        </div>
        <TelegramLinkButton className="block text-xs text-slate-400 hover:text-emerald-400" />
        <button
          onClick={handleLogout}
          className="text-sm text-rose-400 hover:text-rose-300"
        >
          Chiqish
        </button>
      </div>
    </aside>
  );
}
