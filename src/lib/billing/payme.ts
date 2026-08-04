import { rawPrisma } from "@/lib/db/rawPrisma";
import { planByCode } from "./plans";
import { confirmPayment } from "./subscribe";
import { BadRequestError } from "@/lib/auth/guard";
import type { PaymentProvider } from "./provider";

/**
 * PAYME (Paycom) MERCHANT API adapteri.
 *
 * Oqim:
 *  1. Mijoz "Payme orqali to'lash" tugmasini bosadi → PENDING Payment yaratiladi
 *     va checkout.paycom.uz ga yo'naltiriladigan URL qaytariladi.
 *  2. Payme serveri bizning /api/billing/payme endpoint'imizga JSON-RPC
 *     so'rovlar yuboradi (Basic auth: "Paycom:<PAYME_KEY>").
 *  3. PerformTransaction'da obuna uzaytiriladi (confirmPayment) — bu qo'lda
 *     tasdiqlash bilan BIR XIL funksiya, ya'ni hisob mantiqi ikkilanmaydi.
 *
 * Summalar Payme'da TIYIN'da (1 so'm = 100 tiyin).
 * Hujjat: https://developer.help.paycom.uz/protokol-merchant-api/
 */

/** Payme tranzaksiya holatlari. */
export const PAYME_STATE = {
  YARATILDI: 1,
  BAJARILDI: 2,
  BEKOR_YARATILGACH: -1,
  BEKOR_BAJARILGACH: -2,
} as const;

/** Payme protokoli xato kodlari. */
export const PAYME_ERROR = {
  TRANZAKSIYA_TOPILMADI: -31003,
  BAJARIB_BOLMAYDI: -31008,
  BEKOR_QILIB_BOLMAYDI: -31007,
  NOTORI_SUMMA: -31001,
  HISOB_TOPILMADI: -31050,
  AVTORIZATSIYA: -32504,
  METOD_TOPILMADI: -32601,
  NOTORI_SOROV: -32600,
} as const;

const XATO_MATN: Record<number, { uz: string; ru: string; en: string }> = {
  [PAYME_ERROR.TRANZAKSIYA_TOPILMADI]: {
    uz: "Tranzaksiya topilmadi",
    ru: "Транзакция не найдена",
    en: "Transaction not found",
  },
  [PAYME_ERROR.BAJARIB_BOLMAYDI]: {
    uz: "Amalni bajarib bo'lmaydi",
    ru: "Невозможно выполнить операцию",
    en: "Unable to perform operation",
  },
  [PAYME_ERROR.BEKOR_QILIB_BOLMAYDI]: {
    uz: "Tranzaksiyani bekor qilib bo'lmaydi",
    ru: "Невозможно отменить транзакцию",
    en: "Unable to cancel transaction",
  },
  [PAYME_ERROR.NOTORI_SUMMA]: {
    uz: "Noto'g'ri summa",
    ru: "Неверная сумма",
    en: "Invalid amount",
  },
  [PAYME_ERROR.HISOB_TOPILMADI]: {
    uz: "To'lov topilmadi",
    ru: "Платёж не найден",
    en: "Payment not found",
  },
  [PAYME_ERROR.AVTORIZATSIYA]: {
    uz: "Avtorizatsiya xatosi",
    ru: "Ошибка авторизации",
    en: "Authorization error",
  },
  [PAYME_ERROR.METOD_TOPILMADI]: { uz: "Metod topilmadi", ru: "Метод не найден", en: "Method not found" },
  [PAYME_ERROR.NOTORI_SOROV]: { uz: "Noto'g'ri so'rov", ru: "Неверный запрос", en: "Invalid request" },
};

/** Payme hisobidagi maydon nomi: ac.payment_id=<Payment.id>. */
export const PAYME_ACCOUNT_FIELD = "payment_id";

export interface PaymeConfig {
  merchantId: string;
  key: string;
}

export function paymeConfig(): PaymeConfig | null {
  const merchantId = process.env.PAYME_MERCHANT_ID;
  const key = process.env.PAYME_KEY;
  if (!merchantId || !key) return null;
  return { merchantId, key };
}

/** So'm → tiyin. */
export function somToTiyin(som: number): number {
  return Math.round(som * 100);
}

/** checkout.paycom.uz uchun URL (base64 parametrlar bilan). */
export function paymeCheckoutUrl(params: {
  merchantId: string;
  paymentId: string;
  summaSom: number;
  returnUrl: string;
}): string {
  const qism = [
    `m=${params.merchantId}`,
    `ac.${PAYME_ACCOUNT_FIELD}=${params.paymentId}`,
    `a=${somToTiyin(params.summaSom)}`,
    `c=${params.returnUrl}`,
  ].join(";");
  return `https://checkout.paycom.uz/${Buffer.from(qism, "utf8").toString("base64")}`;
}

export const paymeProvider: PaymentProvider = {
  code: "PAYME",
  async initiateCheckout({ planCode }) {
    const cfg = paymeConfig();
    if (!cfg) throw new BadRequestError("Payme hali sozlanmagan");
    const plan = planByCode(planCode);
    if (!plan) throw new BadRequestError("Noma'lum tarif");

    // Tenant kontekstida chaqiriladi — tenantId'ni scoped client o'zi yozadi.
    const { prisma } = await import("@/lib/prisma");
    const payment = await prisma.payment.create({
      data: { amount: plan.oylikNarx, provider: "PAYME", status: "PENDING", plan: plan.code } as never,
    });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://balansa.uz";
    return {
      paymentId: payment.id,
      redirectUrl: paymeCheckoutUrl({
        merchantId: cfg.merchantId,
        paymentId: payment.id,
        summaSom: plan.oylikNarx,
        returnUrl: `${base}/billing`,
      }),
      korsatma: "Payme sahifasiga o'tasiz. To'lov tasdiqlangach obuna avtomatik uzayadi.",
    };
  },
};

// ---------------------------------------------------------------------------
// Merchant API (Payme serveri chaqiradi)
// ---------------------------------------------------------------------------

interface RpcRequest {
  id?: number | string | null;
  method?: string;
  params?: Record<string, any>;
}

function xato(id: RpcRequest["id"], code: number, data?: string) {
  return {
    id: id ?? null,
    error: {
      code,
      message: XATO_MATN[code] ?? { uz: "Xatolik", ru: "Ошибка", en: "Error" },
      ...(data ? { data } : {}),
    },
  };
}

function natija(id: RpcRequest["id"], result: Record<string, unknown>) {
  return { id: id ?? null, result };
}

/** Basic auth sarlavhasini tekshiradi: "Basic base64(Paycom:<key>)". */
export function paymeAuthOk(authHeader: string | null, key: string): boolean {
  if (!authHeader?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const ajratgich = decoded.indexOf(":");
  if (ajratgich < 0) return false;
  const login = decoded.slice(0, ajratgich);
  const parol = decoded.slice(ajratgich + 1);
  return login === "Paycom" && parol === key;
}

const ms = (d: Date | null | undefined): number => (d ? d.getTime() : 0);

/**
 * Payme JSON-RPC so'rovini bajaradi. HTTP qatlami (route) faqat auth va
 * JSON parse bilan shug'ullanadi — protokol mantiqи shu yerda (test qilinadi).
 */
export async function handlePaymeRequest(
  body: RpcRequest,
  authHeader: string | null,
  now: Date = new Date()
): Promise<Record<string, unknown>> {
  const cfg = paymeConfig();
  if (!cfg) return xato(body?.id, PAYME_ERROR.AVTORIZATSIYA, "Payme sozlanmagan");
  if (!paymeAuthOk(authHeader, cfg.key)) return xato(body?.id, PAYME_ERROR.AVTORIZATSIYA);
  if (!body || typeof body.method !== "string") return xato(body?.id, PAYME_ERROR.NOTORI_SOROV);

  const params = body.params ?? {};

  switch (body.method) {
    case "CheckPerformTransaction": {
      const payment = await paymentByAccount(params.account);
      if (!payment) return xato(body.id, PAYME_ERROR.HISOB_TOPILMADI, PAYME_ACCOUNT_FIELD);
      if (payment.status !== "PENDING") {
        return xato(body.id, PAYME_ERROR.BAJARIB_BOLMAYDI, "To'lov holati mos emas");
      }
      if (Number(params.amount) !== somToTiyin(payment.amount)) {
        return xato(body.id, PAYME_ERROR.NOTORI_SUMMA);
      }
      return natija(body.id, { allow: true });
    }

    case "CreateTransaction": {
      const payment = await paymentByAccount(params.account);
      if (!payment) return xato(body.id, PAYME_ERROR.HISOB_TOPILMADI, PAYME_ACCOUNT_FIELD);
      if (Number(params.amount) !== somToTiyin(payment.amount)) {
        return xato(body.id, PAYME_ERROR.NOTORI_SUMMA);
      }

      // Takroriy so'rov (Payme qayta yuborishi mumkin) — o'sha javob qaytadi.
      if (payment.externalId === params.id) {
        if (payment.providerState !== PAYME_STATE.YARATILDI) {
          return xato(body.id, PAYME_ERROR.BAJARIB_BOLMAYDI);
        }
        return natija(body.id, {
          create_time: ms(payment.providerCreatedAt),
          transaction: payment.id,
          state: PAYME_STATE.YARATILDI,
        });
      }
      // Bu to'lov bo'yicha boshqa tranzaksiya bor yoki to'lov yakunlangan.
      if (payment.externalId || payment.status !== "PENDING") {
        return xato(body.id, PAYME_ERROR.BAJARIB_BOLMAYDI, "Bu to'lov band");
      }

      const yaratilgan = new Date(Number(params.time) || now.getTime());
      await rawPrisma.payment.update({
        where: { id: payment.id },
        data: {
          externalId: String(params.id),
          providerState: PAYME_STATE.YARATILDI,
          providerCreatedAt: yaratilgan,
        },
      });
      return natija(body.id, {
        create_time: yaratilgan.getTime(),
        transaction: payment.id,
        state: PAYME_STATE.YARATILDI,
      });
    }

    case "PerformTransaction": {
      const payment = await paymentByExternalId(params.id);
      if (!payment) return xato(body.id, PAYME_ERROR.TRANZAKSIYA_TOPILMADI);

      if (payment.providerState === PAYME_STATE.BAJARILDI) {
        // Idempotent: allaqachon bajarilgan.
        return natija(body.id, {
          transaction: payment.id,
          perform_time: ms(payment.paidAt),
          state: PAYME_STATE.BAJARILDI,
        });
      }
      if (payment.providerState !== PAYME_STATE.YARATILDI) {
        return xato(body.id, PAYME_ERROR.BAJARIB_BOLMAYDI);
      }

      // Obunani uzaytirish — qo'lda tasdiqlash bilan bir xil funksiya.
      await confirmPayment(payment.id, now);
      await rawPrisma.payment.update({
        where: { id: payment.id },
        data: { providerState: PAYME_STATE.BAJARILDI },
      });
      return natija(body.id, {
        transaction: payment.id,
        perform_time: now.getTime(),
        state: PAYME_STATE.BAJARILDI,
      });
    }

    case "CancelTransaction": {
      const payment = await paymentByExternalId(params.id);
      if (!payment) return xato(body.id, PAYME_ERROR.TRANZAKSIYA_TOPILMADI);

      // Allaqachon bekor qilingan — o'sha javob.
      if (
        payment.providerState === PAYME_STATE.BEKOR_YARATILGACH ||
        payment.providerState === PAYME_STATE.BEKOR_BAJARILGACH
      ) {
        return natija(body.id, {
          transaction: payment.id,
          cancel_time: ms(payment.cancelTime),
          state: payment.providerState,
        });
      }

      const bajarilgan = payment.providerState === PAYME_STATE.BAJARILDI;
      const yangiHolat = bajarilgan ? PAYME_STATE.BEKOR_BAJARILGACH : PAYME_STATE.BEKOR_YARATILGACH;
      await rawPrisma.payment.update({
        where: { id: payment.id },
        data: {
          providerState: yangiHolat,
          cancelTime: now,
          cancelReason: params.reason != null ? Number(params.reason) : null,
          // Bajarilgan to'lov bekor qilinsa obuna muddati avtomatik qisqartirilmaydi —
          // superadmin panelida ko'rinadi va qo'lda hal qilinadi (pul qaytarish holati).
          status: bajarilgan ? "REFUNDED" : "REJECTED",
          izoh: bajarilgan
            ? "Payme: to'lov bajarilgach bekor qilindi — obunani tekshiring"
            : "Payme: to'lov bekor qilindi",
        },
      });
      return natija(body.id, {
        transaction: payment.id,
        cancel_time: now.getTime(),
        state: yangiHolat,
      });
    }

    case "CheckTransaction": {
      const payment = await paymentByExternalId(params.id);
      if (!payment) return xato(body.id, PAYME_ERROR.TRANZAKSIYA_TOPILMADI);
      return natija(body.id, {
        create_time: ms(payment.providerCreatedAt),
        perform_time: ms(payment.paidAt),
        cancel_time: ms(payment.cancelTime),
        transaction: payment.id,
        state: payment.providerState ?? 0,
        reason: payment.cancelReason ?? null,
      });
    }

    case "GetStatement": {
      const from = new Date(Number(params.from) || 0);
      const to = new Date(Number(params.to) || now.getTime());
      const list = await rawPrisma.payment.findMany({
        where: {
          provider: "PAYME",
          externalId: { not: null },
          providerCreatedAt: { gte: from, lte: to },
        },
        orderBy: { providerCreatedAt: "asc" },
      });
      return natija(body.id, {
        transactions: list.map((p) => ({
          id: p.externalId,
          time: ms(p.providerCreatedAt),
          amount: somToTiyin(p.amount),
          account: { [PAYME_ACCOUNT_FIELD]: p.id },
          create_time: ms(p.providerCreatedAt),
          perform_time: ms(p.paidAt),
          cancel_time: ms(p.cancelTime),
          transaction: p.id,
          state: p.providerState ?? 0,
          reason: p.cancelReason ?? null,
        })),
      });
    }

    default:
      return xato(body.id, PAYME_ERROR.METOD_TOPILMADI, body.method);
  }
}

async function paymentByAccount(account: unknown) {
  const id = (account as Record<string, unknown> | undefined)?.[PAYME_ACCOUNT_FIELD];
  if (typeof id !== "string" || !id) return null;
  const payment = await rawPrisma.payment.findUnique({ where: { id } });
  return payment && payment.provider === "PAYME" ? payment : null;
}

async function paymentByExternalId(externalId: unknown) {
  if (typeof externalId !== "string" || !externalId) return null;
  return rawPrisma.payment.findFirst({ where: { externalId, provider: "PAYME" } });
}
