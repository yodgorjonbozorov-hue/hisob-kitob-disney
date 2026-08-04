import { prisma } from "@/lib/prisma";
import { planByCode } from "./plans";
import { BadRequestError } from "@/lib/auth/guard";
// Adapterlar faqat TIP darajasida provider.ts ga bog'liq (import type) —
// aylanma runtime bog'liqlik yo'q.
import { paymeProvider, paymeConfig } from "./payme";
import { clickProvider, clickConfig } from "./click";

/**
 * PROVIDER-AGNOSTIK to'lov qatlami.
 *
 * Keyinchalik Payme yoki Click qo'shilganda faqat shu interfeysni amalga
 * oshiruvchi bitta adapter fayl yoziladi — biznes mantiq (checkout route,
 * tasdiqlash, obunani uzaytirish) O'ZGARMAYDI.
 */
export type ProviderCode = "MANUAL" | "PAYME" | "CLICK";

export interface CheckoutResult {
  paymentId: string;
  /** Onlayn provider'larda foydalanuvchi yo'naltiriladigan URL. */
  redirectUrl?: string;
  /** MANUAL'da foydalanuvchiga ko'rsatiladigan to'lov ko'rsatmasi. */
  korsatma?: string;
}

export interface PaymentProvider {
  code: ProviderCode;
  /** To'lovni boshlaydi: PENDING Payment yozuvi yaratadi va davomi uchun ma'lumot qaytaradi. */
  initiateCheckout(params: { planCode: string }): Promise<CheckoutResult>;
}

/**
 * MANUAL provider: mijoz ko'rsatma bo'yicha to'laydi, SUPERADMIN to'lovni
 * tasdiqlaydi (lib/billing/subscribe.ts -> confirmPayment) va muddat uzayadi.
 * Tenant kontekstida chaqiriladi — Payment avtomatik shu tenantga yoziladi.
 */
export const manualProvider: PaymentProvider = {
  code: "MANUAL",
  async initiateCheckout({ planCode }) {
    const plan = planByCode(planCode);
    if (!plan) throw new BadRequestError("Noma'lum tarif");

    const payment = await prisma.payment.create({
      // tenantId'ni tenant-scoped client o'zi yozadi. plan — tasdiqda tenant shu tarifga o'tadi.
      data: { amount: plan.oylikNarx, provider: "MANUAL", status: "PENDING", plan: plan.code } as never,
    });

    const korsatma = [
      `To'lov summasi: ${plan.oylikNarx.toLocaleString("ru-RU")} so'm (${plan.nomi}, 1 oy).`,
      `To'lov raqami: ${payment.id}`,
      "",
      "To'lovni administrator ko'rsatgan rekvizitlarga amalga oshiring va",
      "to'lov raqamini yuboring. Tasdiqlangach obunangiz avtomatik uzayadi.",
    ].join("\n");

    return { paymentId: payment.id, korsatma };
  },
};

export function isProviderCode(v: unknown): v is ProviderCode {
  return v === "MANUAL" || v === "PAYME" || v === "CLICK";
}

/**
 * Provider'lar registri. Onlayn provider'lar FAQAT env sozlangan bo'lsa ochiq —
 * shartnoma imzolangunicha kod turaveradi, mijozga ko'rinmaydi.
 */
function providers(): Record<ProviderCode, PaymentProvider | null> {
  return {
    MANUAL: manualProvider,
    PAYME: paymeConfig() ? paymeProvider : null,
    CLICK: clickConfig() ? clickProvider : null,
  };
}

export function getProvider(code: ProviderCode): PaymentProvider {
  const p = providers()[code];
  if (!p) throw new BadRequestError(`${code} to'lov usuli hali ulanmagan`);
  return p;
}

export interface ProviderInfo {
  code: ProviderCode;
  nomi: string;
  tavsif: string;
}

const PROVIDER_MATN: Record<ProviderCode, { nomi: string; tavsif: string }> = {
  MANUAL: { nomi: "O'tkazma orqali", tavsif: "Rekvizitlarga o'tkazasiz, administrator tasdiqlaydi" },
  PAYME: { nomi: "Payme", tavsif: "Karta orqali onlayn — obuna darhol uzayadi" },
  CLICK: { nomi: "Click", tavsif: "Karta orqali onlayn — obuna darhol uzayadi" },
};

/** Mijozga ko'rsatiladigan to'lov usullari (onlayn — faqat sozlanganlari). */
export function mavjudProviderlar(): ProviderInfo[] {
  const reg = providers();
  return (Object.keys(reg) as ProviderCode[])
    .filter((code) => reg[code] !== null)
    .map((code) => ({ code, ...PROVIDER_MATN[code] }));
}
