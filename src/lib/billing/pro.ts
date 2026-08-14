import { ForbiddenError } from "@/lib/auth/guard";
import type { TenantContext } from "@/lib/auth/tenant";

/**
 * PRO TARIF GATE.
 *
 * Maxsus rollar, shaxsiy kassalar va foydalanuvchidan foydalanuvchiga pul
 * o'tkazish — PRO tarif imkoniyatlari. PRO bo'lmagan mijoz uchun API 403
 * qaytaradi, UI'da esa tugmalar qulflangan holda ko'rsatiladi.
 */

export const PRO_KERAK_XABAR =
  "Bu funksiya PRO tarifda ochiladi — «Obuna va to'lov» bo'limidan tarifni yangilang";

export function isPro(plan: string): boolean {
  return plan === "PRO";
}

export function requirePro(ctx: TenantContext): void {
  if (!isPro(ctx.tenant.plan)) {
    throw new ForbiddenError(PRO_KERAK_XABAR);
  }
}
