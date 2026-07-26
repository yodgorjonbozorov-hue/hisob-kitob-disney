import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** clsx + tailwind-merge — konflikt classlarni to'g'ri birlashtiradi. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
