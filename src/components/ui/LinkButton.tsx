import Link from "next/link";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./buttonStyles";

/**
 * Tugma ko'rinishidagi havola — `Button` bilan AYNI klasslardan foydalanadi.
 * Public sahifalar (landing, kirish, xato ekranlari) shu komponentni ishlatadi,
 * shu bois saytdagi tugmalar ilova ichidagilardan farq qilmaydi.
 *
 * Server komponentida ham ishlaydi ("use client" kerak emas).
 */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
