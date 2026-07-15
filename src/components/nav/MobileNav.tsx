"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Rol } from "@/lib/auth/session";
import { TelegramLinkButton } from "@/components/TelegramLinkButton";

interface Props {
  ism: string;
  rol: Rol;
}

const adminOnlyBaseLinks = [
  { href: "/", label: "Panel" },
  { href: "/tranzaksiyalar", label: "Tranzaksiyalar" },
  { href: "/hisobot", label: "Hisobot" },
];

const kassirLinks = [{ href: "/tranzaksiyalar", label: "Tranzaksiyalar" }];

const adminLinks = [
  { href: "/admin/kategoriyalar", label: "Kategoriyalar" },
  { href: "/admin/foydalanuvchilar", label: "Foydalanuvchilar" },
];

export default function MobileNav({ ism, rol }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = rol === "admin" ? [...adminOnlyBaseLinks, ...adminLinks] : kassirLinks;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="md:hidden bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-bold">Disney Navoiy</span>
        <button
          onClick={() => setOpen(!open)}
          className="text-sm px-3 py-1.5 rounded-lg bg-slate-800"
        >
          {open ? "Yopish" : "Menyu"}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-emerald-600 text-white" : "text-slate-300"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-slate-800 mt-2">
            <p className="text-sm">{ism}</p>
            <p className="text-xs text-slate-400 mb-2">{rol === "admin" ? "Direktor" : "Kassir"}</p>
            <TelegramLinkButton className="block text-xs text-slate-400 mb-2" />
            <button onClick={handleLogout} className="text-sm text-rose-400">
              Chiqish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
