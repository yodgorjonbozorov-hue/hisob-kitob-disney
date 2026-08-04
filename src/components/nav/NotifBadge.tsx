import { runWithTenant } from "@/lib/db/tenantContext";
import { getNotificationCount } from "@/lib/queries/notifications";

interface Props {
  tenantId: string;
  businessId: string;
  rol: string;
  omborli: boolean;
  /** Badge o'lchami — yon menyu va mobil sarlavhada farq qiladi. */
  variant?: "sidebar" | "mobile";
}

/**
 * Bildirishnoma soni — ALOHIDA server komponenti, `<Suspense>` ichida oqim (stream)
 * bilan yetkaziladi.
 *
 * NEGA: bu son budjet, ombor va qarzlar bo'yicha bir nechta so'rovni talab qiladi.
 * Ilgari u layout'da `await` qilinardi va HAR BIR sahifa ochilishini bloklardi —
 * navigatsiya shu sabab sekin ko'rinardi. Endi sahifa darhol chiziladi, badge esa
 * tayyor bo'lishi bilan qo'shiladi.
 *
 * Tenant konteksti (AsyncLocalStorage) React komponentni keyinroq chaqirgani uchun
 * layout'dan MEROS BO'LIB O'TMAYDI — shuning uchun bu yerda qaytadan o'rnatiladi.
 */
export async function NotifBadge({ tenantId, businessId, rol, omborli, variant = "sidebar" }: Props) {
  const count = await runWithTenant(tenantId, () =>
    getNotificationCount(businessId, { rol, omborli }).catch(() => 0)
  );
  if (!count) return null;

  const className =
    variant === "mobile"
      ? "absolute top-0.5 right-0.5 bg-expense text-white text-[10px] font-semibold rounded-full min-w-[16px] h-[16px] px-0.5 flex items-center justify-center"
      : "bg-expense text-white text-2xs font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center tnum";

  return <span className={className}>{count}</span>;
}
