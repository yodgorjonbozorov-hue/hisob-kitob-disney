import Link from "next/link";
import type { Access } from "@/lib/billing/access";

/**
 * Obuna holati banneri: muddat tugashiga <=3 kun qolganda ogohlantirish,
 * READONLY (to'lov o'tgan) rejimida esa doimiy qizil xabar.
 *
 * `iosIlova` — so'rov App Store ilovasi ichidan kelgan. Bunda to'lov sahifasiga
 * havola KO'RSATILMAYDI: App Store 3.1.1 raqamli obunani ilovadan tashqarida
 * sotishga yo'naltirishni taqiqlaydi. Xabarning o'zi qoladi — foydalanuvchi
 * nima bo'layotganini bilishi kerak.
 */
export function BillingBanner({ access, iosIlova = false }: { access: Access; iosIlova?: boolean }) {
  if (access.mode === "READONLY" && access.sabab) {
    return (
      <div className="mb-4 rounded-xl border border-expense/40 bg-expense-soft text-expense-fg px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span>{access.sabab}</span>
        {!iosIlova && (
          <Link href="/billing" className="font-medium underline shrink-0">
            To&apos;lov qilish →
          </Link>
        )}
      </div>
    );
  }
  if (access.ogohlantirish) {
    return (
      <div className="mb-4 rounded-xl border border-line bg-brand-wash text-fg px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span>{access.ogohlantirish}</span>
        {!iosIlova && (
          <Link href="/billing" className="font-medium text-brand underline shrink-0">
            Obuna →
          </Link>
        )}
      </div>
    );
  }
  return null;
}
