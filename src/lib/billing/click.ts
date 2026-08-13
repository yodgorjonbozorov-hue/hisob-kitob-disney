import { createHash } from "node:crypto";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { planByCode } from "./plans";
import { confirmPayment } from "./subscribe";
import { BadRequestError } from "@/lib/auth/guard";
import type { PaymentProvider } from "./provider";
import { secretlarTeng } from "@/lib/security/compare";

/**
 * CLICK (SHOP API) adapteri.
 *
 * Oqim:
 *  1. Mijoz "Click orqali to'lash" tugmasini bosadi → PENDING Payment yaratiladi
 *     va my.click.uz to'lov sahifasiga yo'naltiriladi (merchant_trans_id = Payment.id).
 *  2. Click ikki marta chaqiradi:
 *       Prepare  (action=0) → to'lovni tekshiramiz va "tayyor" deb belgilaymiz;
 *       Complete (action=1) → obunani uzaytiramiz (confirmPayment).
 *  3. Har so'rov md5 imzo bilan tekshiriladi (SECRET_KEY).
 *
 * Summalar Click'da SO'M'da (kasr bilan). Hujjat: https://docs.click.uz/click-api-request/
 */

/** Click javob kodlari (0 — muvaffaqiyat). */
export const CLICK_ERROR = {
  OK: 0,
  IMZO_XATO: -1,
  SUMMA_XATO: -2,
  AMAL_TOPILMADI: -3,
  ALLAQACHON_TOLANGAN: -4,
  TOPILMADI: -5,
  TRANZAKSIYA_TOPILMADI: -6,
  YANGILASH_XATOSI: -7,
  SOROV_XATOSI: -8,
  BEKOR_QILINGAN: -9,
} as const;

const XATO_MATN: Record<number, string> = {
  [CLICK_ERROR.OK]: "Success",
  [CLICK_ERROR.IMZO_XATO]: "SIGN CHECK FAILED",
  [CLICK_ERROR.SUMMA_XATO]: "Incorrect parameter amount",
  [CLICK_ERROR.AMAL_TOPILMADI]: "Action not found",
  [CLICK_ERROR.ALLAQACHON_TOLANGAN]: "Already paid",
  [CLICK_ERROR.TOPILMADI]: "Payment not found",
  [CLICK_ERROR.TRANZAKSIYA_TOPILMADI]: "Transaction does not exist",
  [CLICK_ERROR.YANGILASH_XATOSI]: "Failed to update",
  [CLICK_ERROR.SOROV_XATOSI]: "Error in request from click",
  [CLICK_ERROR.BEKOR_QILINGAN]: "Transaction cancelled",
};

/** Click tranzaksiya holatlari (Payment.providerState). */
export const CLICK_STATE = { TAYYOR: 1, TOLANDI: 2, BEKOR: -1 } as const;

export interface ClickConfig {
  serviceId: string;
  merchantId: string;
  secretKey: string;
}

export function clickConfig(): ClickConfig | null {
  const serviceId = process.env.CLICK_SERVICE_ID;
  const merchantId = process.env.CLICK_MERCHANT_ID;
  const secretKey = process.env.CLICK_SECRET_KEY;
  if (!serviceId || !merchantId || !secretKey) return null;
  return { serviceId, merchantId, secretKey };
}

export function clickCheckoutUrl(params: {
  serviceId: string;
  merchantId: string;
  paymentId: string;
  summaSom: number;
  returnUrl: string;
}): string {
  const q = new URLSearchParams({
    service_id: params.serviceId,
    merchant_id: params.merchantId,
    amount: String(params.summaSom),
    transaction_param: params.paymentId,
    return_url: params.returnUrl,
  });
  return `https://my.click.uz/services/pay?${q.toString()}`;
}

export const clickProvider: PaymentProvider = {
  code: "CLICK",
  async initiateCheckout({ planCode }) {
    const cfg = clickConfig();
    if (!cfg) throw new BadRequestError("Click hali sozlanmagan");
    const plan = planByCode(planCode);
    if (!plan) throw new BadRequestError("Noma'lum tarif");

    const { prisma } = await import("@/lib/prisma");
    const payment = await prisma.payment.create({
      data: { amount: plan.oylikNarx, provider: "CLICK", status: "PENDING", plan: plan.code } as never,
    });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://balansa.uz";
    return {
      paymentId: payment.id,
      redirectUrl: clickCheckoutUrl({
        serviceId: cfg.serviceId,
        merchantId: cfg.merchantId,
        paymentId: payment.id,
        summaSom: plan.oylikNarx,
        returnUrl: `${base}/billing`,
      }),
      korsatma: "Click sahifasiga o'tasiz. To'lov tasdiqlangach obuna avtomatik uzayadi.",
    };
  },
};

// ---------------------------------------------------------------------------
// SHOP API (Click serveri chaqiradi)
// ---------------------------------------------------------------------------

export interface ClickRequest {
  click_trans_id?: string | number;
  service_id?: string | number;
  merchant_trans_id?: string;
  merchant_prepare_id?: string | number;
  amount?: string | number;
  action?: string | number;
  sign_time?: string;
  sign_string?: string;
  error?: string | number;
}

/**
 * Imzo: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id +
 * [merchant_prepare_id — faqat Complete'da] + amount + action + sign_time).
 */
export function clickSign(req: ClickRequest, secretKey: string, complete: boolean): string {
  const qismlar = [
    req.click_trans_id,
    req.service_id,
    secretKey,
    req.merchant_trans_id,
    ...(complete ? [req.merchant_prepare_id] : []),
    req.amount,
    req.action,
    req.sign_time,
  ];
  return createHash("md5").update(qismlar.join(""), "utf8").digest("hex");
}

function javob(req: ClickRequest, error: number, qoshimcha: Record<string, unknown> = {}) {
  return {
    click_trans_id: req.click_trans_id,
    merchant_trans_id: req.merchant_trans_id,
    error,
    error_note: XATO_MATN[error] ?? "Error",
    ...qoshimcha,
  };
}

/** Summalarni taqqoslash — Click "199000.00" ko'rinishida yuborishi mumkin. */
function summaTeng(kelgan: unknown, kutilgan: number): boolean {
  const n = typeof kelgan === "number" ? kelgan : parseFloat(String(kelgan ?? ""));
  if (!Number.isFinite(n)) return false;
  return Math.round(n) === kutilgan;
}

/**
 * Prepare (action=0): to'lovni tekshiradi va "tayyor" holatiga o'tkazadi.
 * merchant_prepare_id sifatida Payment.id qaytariladi.
 */
export async function handleClickPrepare(req: ClickRequest, now: Date = new Date()) {
  const cfg = clickConfig();
  if (!cfg) return javob(req, CLICK_ERROR.SOROV_XATOSI);
  if (String(req.action) !== "0") return javob(req, CLICK_ERROR.AMAL_TOPILMADI);
  if (!secretlarTeng(String(req.sign_string ?? ""), clickSign(req, cfg.secretKey, false))) {
    return javob(req, CLICK_ERROR.IMZO_XATO);
  }

  const payment = await paymentById(req.merchant_trans_id);
  if (!payment) return javob(req, CLICK_ERROR.TOPILMADI);
  if (!summaTeng(req.amount, payment.amount)) return javob(req, CLICK_ERROR.SUMMA_XATO);
  if (payment.status === "CONFIRMED") return javob(req, CLICK_ERROR.ALLAQACHON_TOLANGAN);
  if (payment.status !== "PENDING") return javob(req, CLICK_ERROR.BEKOR_QILINGAN);

  try {
    await rawPrisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: String(req.click_trans_id),
        providerState: CLICK_STATE.TAYYOR,
        providerCreatedAt: payment.providerCreatedAt ?? now,
      },
    });
  } catch {
    // `externalId` @unique — bir xil click_trans_id boshqa to'lovga allaqachon
    // biriktirilgan bo'lsa, 500 o'rniga protokol xatosi qaytadi (M-11).
    return javob(req, CLICK_ERROR.TRANZAKSIYA_TOPILMADI);
  }

  return javob(req, CLICK_ERROR.OK, { merchant_prepare_id: payment.id });
}

/**
 * Complete (action=1): to'lov yakunlandi — obuna uzaytiriladi.
 * Click xato bilan kelsa (error < 0) tranzaksiya bekor qilinadi.
 */
export async function handleClickComplete(req: ClickRequest, now: Date = new Date()) {
  const cfg = clickConfig();
  if (!cfg) return javob(req, CLICK_ERROR.SOROV_XATOSI);
  if (String(req.action) !== "1") return javob(req, CLICK_ERROR.AMAL_TOPILMADI);
  if (!secretlarTeng(String(req.sign_string ?? ""), clickSign(req, cfg.secretKey, true))) {
    return javob(req, CLICK_ERROR.IMZO_XATO);
  }

  const payment = await paymentById(req.merchant_trans_id);
  if (!payment) return javob(req, CLICK_ERROR.TOPILMADI);
  if (String(req.merchant_prepare_id) !== payment.id) {
    return javob(req, CLICK_ERROR.TRANZAKSIYA_TOPILMADI);
  }
  if (!summaTeng(req.amount, payment.amount)) return javob(req, CLICK_ERROR.SUMMA_XATO);

  // Click o'z tomonidan xato yubordi — to'lov bekor qilinadi.
  if (req.error != null && Number(req.error) < 0) {
    await rawPrisma.payment.update({
      where: { id: payment.id },
      data: {
        providerState: CLICK_STATE.BEKOR,
        cancelTime: now,
        status: "REJECTED",
        izoh: `Click: to'lov bekor qilindi (${req.error})`,
      },
    });
    return javob(req, CLICK_ERROR.BEKOR_QILINGAN);
  }

  // Idempotent: takroriy Complete o'sha javobni qaytaradi.
  if (payment.status === "CONFIRMED") {
    return javob(req, CLICK_ERROR.ALLAQACHON_TOLANGAN, { merchant_confirm_id: payment.id });
  }
  if (payment.providerState !== CLICK_STATE.TAYYOR) {
    return javob(req, CLICK_ERROR.TRANZAKSIYA_TOPILMADI);
  }

  await confirmPayment(payment.id, now);
  await rawPrisma.payment.update({
    where: { id: payment.id },
    data: { providerState: CLICK_STATE.TOLANDI },
  });

  return javob(req, CLICK_ERROR.OK, { merchant_confirm_id: payment.id });
}

async function paymentById(id: unknown) {
  if (typeof id !== "string" || !id) return null;
  const payment = await rawPrisma.payment.findUnique({ where: { id } });
  return payment && payment.provider === "CLICK" ? payment : null;
}
