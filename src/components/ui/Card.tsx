import { cn } from "@/lib/cn";

/**
 * Kontent kartochkasi.
 *
 * Ichki bo'shliq telefonda kichikroq (16px): 360px ekranda 20px×2 bo'shliq
 * kontentga qolgan joyning 11% ini yeydi — jadval va summalar shuncha
 * siqiladi.
 *
 * `className` konfliktda USTUN turadi (tailwind-merge). Ilgari oddiy satr
 * birlashtirish ishlatilardi va `<Card className="p-0">` ta'sir qilmasdi —
 * `p-5` CSS tartibida keyin kelib uni bosib ketardi.
 */
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface rounded-2xl shadow-card border border-line p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
