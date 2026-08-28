"use client";

import { useEffect, useRef, useState } from "react";

export interface KartaAmal {
  label: string;
  onClick: () => void;
}

/**
 * KARTA AMALLARI ("⋯") — kichik ochiluvchi ro'yxat.
 *
 * Nega alohida menyu: kassa kartasida to'rttagacha amal bor (batafsil,
 * o'tkazish, topshirish, tahrirlash). Ularni kartaga tugma qilib joylashtirsa
 * 375px ekranda karta faqat tugmadan iborat bo'lib qolardi va eng muhim
 * element — summa — ko'zdan yo'qolardi.
 *
 * Barmoq uchun har qator 44px. Tashqariga bosilganda va Escape'da yopiladi;
 * ochilganda birinchi amalga fokus beriladi (klaviatura bilan ham yuriladi).
 */
export function KartaMenyu({ amallar, yorliq }: { amallar: KartaAmal[]; yorliq: string }) {
  const [ochiq, setOchiq] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ochiq) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOchiq(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ochiq]);

  if (amallar.length === 0) return null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={`${yorliq} — amallar`}
        aria-expanded={ochiq}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOchiq((v) => !v);
        }}
        className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center rounded-lg text-faint hover:text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="text-lg leading-none" aria-hidden="true">
          ⋯
        </span>
      </button>

      {ochiq && (
        <>
          {/* Tashqariga bosish — yopiladi. Menyu ustidan bosilsa unga tegmaydi. */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOchiq(false);
            }}
          />
          <div
            ref={panel}
            role="menu"
            className="absolute right-0 top-10 z-50 min-w-[11rem] rounded-xl border border-line bg-surface shadow-raised py-1"
          >
            {amallar.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOchiq(false);
                  a.onClick();
                }}
                className="w-full text-left px-4 min-h-[44px] text-sm text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
