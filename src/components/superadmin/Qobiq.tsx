"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut, PanelLeftClose, PanelLeft, CircleDot } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { saIkon } from "./ikonlar";
import { Palitra } from "./Palitra";
import { SoglikBelgisi } from "./belgilar";
import { bolimniTop, type SaNavBolim } from "@/lib/superadmin/navigatsiya";
import { SUPER_ROL_LABEL, type SuperRol } from "@/lib/superadmin/rbac";

/**
 * CONTROL CENTER QOBIG'I (talab 2/3/40).
 *
 * Desktop: yig'iladigan yon panel + yuqori panel.
 * Mobil (<1024px): yon panel yashiriladi va tugma bilan chiqadigan
 * "drawer" ga aylanadi; sahifa mazmuni to'liq kenglikni oladi.
 *
 * Yig'ilgan holat `localStorage` da saqlanadi — har sahifada qayta yig'ish
 * kerak emas.
 */
export function Qobiq({
  bolimlar,
  ism,
  superRol,
  tizimHolat,
  children,
}: {
  bolimlar: SaNavBolim[];
  ism: string;
  superRol: SuperRol;
  tizimHolat: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [yigilgan, setYigilgan] = useState(false);

  useEffect(() => {
    setYigilgan(localStorage.getItem("sa-sidebar") === "yigilgan");
  }, []);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  function yigishniAlmashtir() {
    const yangi = !yigilgan;
    setYigilgan(yangi);
    localStorage.setItem("sa-sidebar", yangi ? "yigilgan" : "ochiq");
  }

  async function chiqish() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const joriy = bolimniTop(pathname);

  const nav = (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5" aria-label="Control Center bo'limlari">
      {bolimlar.map((b) => {
        const Icon = saIkon(b.icon);
        const faol = b.href === "/superadmin" ? pathname === b.href : pathname.startsWith(b.href);
        return (
          <Link
            key={b.href}
            href={b.href}
            aria-current={faol ? "page" : undefined}
            title={yigilgan ? b.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              faol
                ? "bg-brand-wash text-brand font-medium"
                : "text-muted hover:bg-surface-2 hover:text-fg"
            )}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={faol ? 2.25 : 2} aria-hidden="true" />
            {!yigilgan && <span className="truncate">{b.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const past = (
    <div className="border-t border-line p-3">
      {!yigilgan && (
        <div className="mb-2">
          <p className="text-sm font-medium text-fg truncate">{ism}</p>
          <p className="text-2xs text-muted">{SUPER_ROL_LABEL[superRol]}</p>
        </div>
      )}
      <div className={cn("flex items-center gap-2", yigilgan && "flex-col")}>
        <Link
          href="/superadmin/tizim"
          className="flex items-center gap-1.5 text-2xs text-muted hover:text-fg"
          title={`Tizim holati: ${tizimHolat}`}
        >
          <CircleDot
            className={cn(
              "w-3.5 h-3.5",
              tizimHolat === "SOG'LOM"
                ? "text-income"
                : tizimHolat === "KRITIK"
                  ? "text-expense"
                  : "text-warning"
            )}
            aria-hidden="true"
          />
          {!yigilgan && <span>Tizim</span>}
        </Link>
        <div className="flex-1" />
        <ThemeToggle />
        <button
          type="button"
          onClick={chiqish}
          aria-label="Tizimdan chiqish"
          className="p-1.5 rounded-lg text-muted hover:bg-surface-2 hover:text-fg transition"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-app">
      {/* Desktop yon panel */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-line bg-surface shrink-0 transition-[width]",
          yigilgan ? "w-16" : "w-60"
        )}
      >
        <div className="h-14 flex items-center gap-2 px-3 border-b border-line">
          {!yigilgan && (
            <Link href="/superadmin" className="flex items-center gap-2 min-w-0">
              <Logo className="h-6 w-auto shrink-0" />
              <span className="text-2xs font-semibold tracking-wide text-brand truncate">
                CONTROL CENTER
              </span>
            </Link>
          )}
          <button
            type="button"
            onClick={yigishniAlmashtir}
            aria-label={yigilgan ? "Panelni ochish" : "Panelni yig'ish"}
            className="ml-auto p-1.5 rounded-lg text-muted hover:bg-surface-2 hover:text-fg transition"
          >
            {yigilgan ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
        {nav}
        {past}
      </aside>

      {/* Mobil drawer */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="relative w-64 bg-surface border-r border-line flex flex-col animate-fade-in">
            <div className="h-14 flex items-center justify-between px-3 border-b border-line">
              <span className="text-2xs font-semibold tracking-wide text-brand">CONTROL CENTER</span>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Menyuni yopish"
                className="p-1.5 rounded-lg text-muted hover:bg-surface-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {nav}
            {past}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-line bg-surface flex items-center gap-3 px-3 md:px-5 sticky top-0 z-30">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Menyuni ochish"
            className="lg:hidden p-1.5 rounded-lg text-muted hover:bg-surface-2"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:block min-w-0">
            <p className="text-2xs text-faint">Control Center</p>
            <h1 className="text-sm font-medium text-fg truncate">{joriy?.label ?? "Bosh sahifa"}</h1>
          </div>
          <div className="flex-1 flex justify-center px-2">
            <Palitra bolimlar={bolimlar} />
          </div>
          <div className="hidden md:block">
            <SoglikBelgisi holat={tizimHolat} />
          </div>
        </header>

        <main className="flex-1 p-3 md:p-5 lg:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
