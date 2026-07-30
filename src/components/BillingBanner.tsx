import Link from "next/link";
import type { Access } from "@/lib/billing/access";

/**
 * Obuna holati banneri: muddat tugashiga oz qolganda (TRIAL_OGOHLANTIRISH_KUNLARI) ogohlantirish,
 * READONLY (to'lov o'tgan) rejimida esa doimiy qizil xabar.
 */
export function BillingBanner({ access }: { access: Access }) {
  if (access.mode === "READONLY" && access.sabab) {
    return (
      <div className="mb-4 rounded-xl border border-expense/40 bg-expense-soft text-expense-fg px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span>{access.sabab}</span>
        <Link href="/billing" className="font-medium underline shrink-0">
          To'lov qilish →
        </Link>
      </div>
    );
  }
  if (access.ogohlantirish) {
    return (
      <div className="mb-4 rounded-xl border border-line bg-brand-wash text-fg px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span>{access.ogohlantirish}</span>
        <Link href="/billing" className="font-medium text-brand underline shrink-0">
          Obuna →
        </Link>
      </div>
    );
  }
  return null;
}
