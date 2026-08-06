"use client";

import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand hover:brightness-110 text-white shadow-sm",
  secondary: "bg-surface-2 hover:bg-line text-fg",
  danger: "bg-expense hover:brightness-110 text-white shadow-sm",
  ghost: "bg-transparent hover:bg-surface-2 text-muted hover:text-fg",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs min-h-[36px]",
  md: "px-4 py-2 text-sm min-h-[44px]",
  lg: "px-5 py-2.5 text-base min-h-[48px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  // HTML'da tugmaning default turi "submit" — forma ichidagi har qanday tugma
  // (masalan "Bekor qilish") formani yuborib yuborardi. Endi default "button",
  // yuboruvchi tugmalarda `type="submit"` ANIQ yoziladi.
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
