"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { ikon } from "./ikonlar";
import type { NavBolim, NavItem } from "@/lib/modules/registry";

/**
 * YON MENYU RO'YXATI — bo'limlarga ajratilgan.
 *
 * "Sozlamalar" bo'limi YIG'ILGAN holda ochiladi: unda kamdan-kam kerak
 * bo'ladigan boshqaruv havolalari (bizneslar, rollar, audit, obuna) turadi
 * va ular ilgari kundalik amallar bilan bitta uzun ro'yxatda aralashib
 * ketardi. Foydalanuvchi shu bo'limdagi sahifada tursa — bo'lim OCHIQ
 * holda chiziladi, aks holda o'zi qayerdaligini yo'qotardi.
 *
 * Bu komponent HECH QANDAY havolani yashirmaydi va qo'shmaydi: ro'yxat
 * to'liq registry'dan (rol + modul shartlari bilan) keladi.
 */
export function SidebarNav({
  bolimlar,
  pathname,
  yuqori,
}: {
  bolimlar: NavBolim[];
  pathname: string;
  /** Ro'yxatdan oldin chiziladigan qatorlar (masalan Bildirishnomalar). */
  yuqori?: React.ReactNode;
}) {
  const sozlamalardaMi = bolimlar
    .find((b) => b.guruh === "sozlamalar")
    ?.items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  const [sozlamalarOchiq, setSozlamalarOchiq] = useState(Boolean(sozlamalardaMi));

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {yuqori}
      {bolimlar.map((bolim) => {
        // "Asosiy" bo'limi sarlavhasiz — u menyuning boshi, izohga muhtoj emas.
        if (bolim.guruh === "asosiy") {
          return (
            <div key={bolim.guruh} className="space-y-0.5">
              {bolim.items.map((l) => (
                <NavQator key={l.href} item={l} active={pathname === l.href} />
              ))}
            </div>
          );
        }
        if (bolim.guruh === "sozlamalar") {
          return (
            <div key={bolim.guruh} className="pt-3">
              <button
                type="button"
                onClick={() => setSozlamalarOchiq((v) => !v)}
                aria-expanded={sozlamalarOchiq}
                className="w-full flex items-center gap-2 px-1 pb-1.5 text-2xs text-faint uppercase tracking-wide hover:text-muted transition"
              >
                <span className="flex-1 text-left">{bolim.yorliq}</span>
                <ChevronDown
                  className={cn("w-3.5 h-3.5 transition-transform", sozlamalarOchiq && "rotate-180")}
                  aria-hidden
                />
              </button>
              {sozlamalarOchiq && (
                <div className="space-y-0.5">
                  {bolim.items.map((l) => (
                    <NavQator key={l.href} item={l} active={pathname === l.href} />
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <div key={bolim.guruh} className="pt-3">
            <p className="text-2xs text-faint px-1 pb-1.5 uppercase tracking-wide">{bolim.yorliq}</p>
            <div className="space-y-0.5">
              {bolim.items.map((l) => (
                <NavQator key={l.href} item={l} active={pathname === l.href} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function NavQator({ item, active }: { item: NavItem; active: boolean }) {
  return <SidebarLink href={item.href} label={item.label} Icon={ikon(item.icon)} active={active} />;
}

/** Yagona havola qatori — badge bilan ham ishlatiladi (Bildirishnomalar). */
export function SidebarLink({
  href,
  label,
  Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
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
}
