import { cn } from "@/lib/cn";

/**
 * Tugma uslublari — YAGONA manba.
 *
 * `Button` (ilova ichidagi <button>) va `LinkButton` (sayt havolalari) ayni shu
 * klasslardan foydalanadi. Shu sabab public saytdagi "Bepul boshlash" tugmasi
 * bilan ilova ichidagi "Saqlash" tugmasi bir xil o'lcham, radius va bosish
 * zonasiga ega bo'ladi — dizayn ikkiga ajralmaydi.
 *
 * Faqat token klasslar (brand/surface/expense) ishlatiladi — Tailwind default
 * palitrasi yo'q, shu bois qorong'i mavzuda ham to'g'ri bo'yaladi.
 */

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition " +
  "disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const VARIANT: Record<ButtonVariant, string> = {
  // Matn rangi `text-brand-fg` — qorong'i mavzuda brend rangi yorqin teal'ga
  // o'tadi va qattiq `text-white` o'qilmay qoladi; token esa mavzu bilan
  // birga almashadi.
  primary: "bg-brand hover:brightness-110 text-brand-fg shadow-sm",
  secondary: "bg-surface-2 hover:bg-line text-fg",
  danger: "bg-expense hover:brightness-110 text-white shadow-sm",
  ghost: "bg-transparent hover:bg-surface-2 text-muted hover:text-fg",
};

// Balandliklar barmoq uchun: md = 44px (iOS tavsiyasi), lg = 48px.
const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs min-h-[36px]",
  md: "px-4 py-2 text-sm min-h-[44px]",
  lg: "px-5 py-2.5 text-base min-h-[48px]",
};

/** Tugma klasslari. `className` konflikt bo'lsa ustun turadi (tailwind-merge). */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = ""
): string {
  return cn(BASE, SIZE[size], VARIANT[variant], className);
}
