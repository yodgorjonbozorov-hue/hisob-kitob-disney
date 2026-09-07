/**
 * Tenant holatidan kirish rejimini hisoblaydi. SOF funksiya — test qilish oson.
 *
 * Rejimlar:
 *  - FULL         — hammasi ochiq
 *  - READONLY     — to'lov muddati o'tgan (PAST_DUE yoki ACTIVE davri tugagan):
 *                   ma'lumot O'CHIRILMAYDI, yozish bloklanadi, o'qish/eksport ishlaydi
 *  - BILLING_ONLY — TRIAL tugagan yoki BLOCKED: faqat /billing ochiladi
 */
export type AccessMode = "FULL" | "READONLY" | "BILLING_ONLY";

export interface TenantHolat {
  status: string; // TRIAL | ACTIVE | PAST_DUE | BLOCKED
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  /** Doimiy bepul mijoz — muddat va to'lov tekshirilmaydi. */
  bepul?: boolean;
  /** Demo kompaniya — mehmonga ko'rsatiladigan namunaviy tenant. */
  demo?: boolean;
}

export interface Access {
  mode: AccessMode;
  /**
   * DEMO REJIMI. `mode` ga ATAYLAB aralashmaydi: demo tenant obuna jihatidan
   * mutlaqo sog'lom (`FULL`), shu bois billing bannerlari va `/billing`
   * redirect'lari avvalgidek ishlaydi. Yozish qulfi esa `mode` dan MUSTAQIL
   * qo'llanadi (lib/auth/demo.ts) — ya'ni rejim qanday hisoblanishidan
   * qat'i nazar demo hech qachon yoza olmaydi.
   */
  demo: boolean;
  /** Foydalanuvchiga ko'rsatiladigan sabab (banner/xato matni). */
  sabab: string | null;
  /** Amaldagi muddat tugashiga necha kun qoldi (salbiy — o'tib ketgan). null — muddatsiz. */
  kunQoldi: number | null;
  /** Muddat tugashiga 3 kun yoki undan kam qolganda ogohlantirish. */
  ogohlantirish: string | null;
}

const KUN_MS = 24 * 60 * 60 * 1000;

export function computeAccess(tenant: TenantHolat, now: Date = new Date()): Access {
  const demo = tenant.demo === true;
  const deadline =
    tenant.status === "TRIAL" ? tenant.trialEndsAt : tenant.currentPeriodEnd;
  const kunQoldi = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / KUN_MS) : null;

  if (tenant.status === "BLOCKED") {
    return { demo, mode: "BILLING_ONLY", sabab: "Hisobingiz bloklangan. To'lov bo'limiga murojaat qiling.", kunQoldi, ogohlantirish: null };
  }

  // Doimiy bepul mijoz — muddat tugasa ham hammasi ochiq (bloklashdan keyin
  // tekshiriladi: bloklangan mijoz baribir yopiq qoladi).
  if (tenant.bepul) {
    return { demo, mode: "FULL", sabab: null, kunQoldi: null, ogohlantirish: null };
  }

  if (tenant.status === "PAST_DUE") {
    return {
      demo,
      mode: "READONLY",
      sabab: "Obuna muddati tugagan — ma'lumotlaringiz saqlanadi, faqat o'qish/eksport mumkin. Davom etish uchun to'lov qiling.",
      kunQoldi,
      ogohlantirish: null,
    };
  }

  if (tenant.status === "TRIAL") {
    if (deadline && deadline.getTime() < now.getTime()) {
      return { demo, mode: "BILLING_ONLY", sabab: "14 kunlik bepul sinov muddati tugadi. Davom etish uchun obuna bo'ling.", kunQoldi, ogohlantirish: null };
    }
    return {
      demo,
      mode: "FULL",
      sabab: null,
      kunQoldi,
      ogohlantirish:
        kunQoldi !== null && kunQoldi <= 3
          ? `Bepul sinov muddati ${kunQoldi} kundan keyin tugaydi. Uzilishsiz davom etish uchun obuna bo'ling.`
          : null,
    };
  }

  // ACTIVE: davri tugagan bo'lsa — READONLY (cron statusni PAST_DUE ga o'tkazguncha ham himoya ishlaydi).
  if (tenant.status === "ACTIVE") {
    if (deadline && deadline.getTime() < now.getTime()) {
      return {
        demo,
        mode: "READONLY",
        sabab: "Obuna muddati tugagan — ma'lumotlaringiz saqlanadi, faqat o'qish/eksport mumkin. Davom etish uchun to'lov qiling.",
        kunQoldi,
        ogohlantirish: null,
      };
    }
    return {
      demo,
      mode: "FULL",
      sabab: null,
      kunQoldi,
      ogohlantirish:
        kunQoldi !== null && kunQoldi <= 3
          ? `Obuna muddati ${kunQoldi} kundan keyin tugaydi. Uzilishsiz davom etish uchun to'lovni yangilang.`
          : null,
    };
  }

  // Noma'lum status — xavfsizlik uchun yopamiz.
  return { demo, mode: "BILLING_ONLY", sabab: "Hisob holati noma'lum. To'lov bo'limiga murojaat qiling.", kunQoldi, ogohlantirish: null };
}
