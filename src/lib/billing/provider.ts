import { prisma } from "@/lib/prisma";
import { planByCode } from "./plans";
import { BadRequestError } from "@/lib/auth/guard";

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

const providers: Record<ProviderCode, PaymentProvider | null> = {
  MANUAL: manualProvider,
  PAYME: null, // rasmiy shartnomadan keyin adapter yoziladi
  CLICK: null,
};

export function getProvider(code: ProviderCode): PaymentProvider {
  const p = providers[code];
  if (!p) throw new BadRequestError(`${code} to'lov usuli hali ulanmagan`);
  return p;
}
