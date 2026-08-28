"use client";

import { Money } from "@/components/ui/Money";
import { buttonClass } from "@/components/ui/buttonStyles";

/**
 * MOBIL STICKY AMAL PANELI — asosiy harakat scroll bilan yo'qolmaydi.
 *
 * ═══ JOYLASHUV ═══
 * Faqat `< sm` da ko'rinadi (desktopda amallar kartaning o'zida). Pastki
 * tab-bar (BottomNav) ustida turadi: `bottom-16` uning balandligi, `pb-safe`
 * esa iPhone "iyagi" (home indicator) uchun. Ikkisisiz panel tugmalari
 * navigatsiya bilan ustma-ust tushardi.
 *
 * Sahifa oxirida panel kontentni yopib qolmasligi uchun tashqarida
 * `pb-[env(safe-area-inset-bottom)]` li bo'sh joy qo'yiladi (KunlikClient).
 */
export function StickyAmal({
  holat,
  qoldiq,
  loading,
  onTopshirish,
  onQabul,
  onRad,
  tasdiqlaydi,
  bugungi,
}: {
  holat: "OPEN" | "SUBMITTED" | "CONFIRMED";
  qoldiq: number;
  loading: boolean;
  onTopshirish: () => void;
  onQabul: () => void;
  onRad: () => void;
  tasdiqlaydi: boolean;
  bugungi: boolean;
}) {
  // Tasdiqlangan kunda mobil panelning ma'nosi yo'q — joyni bo'shatamiz.
  if (holat === "CONFIRMED") return null;
  if (holat === "OPEN" && !bugungi) return null;
  if (holat === "SUBMITTED" && !tasdiqlaydi) return null;

  return (
    <div className="sm:hidden fixed left-0 right-0 bottom-16 z-30 px-3 pb-safe pointer-events-none">
      <div className="pointer-events-auto rounded-2xl border border-line bg-surface/95 backdrop-blur shadow-lg p-3">
        {holat === "OPEN" ? (
          <>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-2xs text-muted">Kassada (tizim)</span>
              <Money
                value={qoldiq}
                size="md"
                tone={qoldiq < 0 ? "expense" : "brand"}
                signed={qoldiq < 0}
              />
            </div>
            <button
              type="button"
              onClick={onTopshirish}
              className={buttonClass("primary", "lg", "w-full")}
            >
              📤 Direktorga topshirish
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRad}
              disabled={loading}
              className={buttonClass("secondary", "lg", "flex-1")}
            >
              Rad etish
            </button>
            <button
              type="button"
              onClick={onQabul}
              disabled={loading}
              className={buttonClass("primary", "lg", "flex-1")}
            >
              ✅ Qabul qilish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
