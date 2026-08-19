import { rawPrisma } from "@/lib/db/rawPrisma";
import type { SuperadminCtx } from "@/lib/auth/superadmin";

/**
 * SUPERADMIN AUDIT 2.0 — imtiyozli amalning to'liq izi.
 *
 * 2.0 gacha `logSuperadminAction` faqat KIM / NIMA / QAYSI OBYEKT ni yozardi.
 * Endi har yozuv quyidagi savollarga javob beradi (talab 22 va 57):
 *
 *   WHO     — aktor id + ismi (impersonatsiyada ikkalasi ham)
 *   WHAT    — kanonik amal kodi (`SA_AMAL`)
 *   TARGET  — entity + entityId (+ qaysi kompaniya)
 *   WHEN    — createdAt
 *   WHERE   — IP va qurilma satri (userAgent)
 *   BEFORE  — o'zgarishdan oldingi holat
 *   AFTER   — keyingi holat
 *   REASON  — xavfli amalda MAJBURIY sabab
 *
 * Yozuv `AuditLog` ga tushadi va u APPEND-ONLY (lib/db/rawPrisma.ts) —
 * superadmin o'z izini o'chira olmaydi.
 */

/** Kanonik amal kodlari. Yangi imtiyozli amal qo'shilsa SHU YERGA yoziladi. */
export const SA_AMAL = {
  LOGIN: "LOGIN",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",

  BUSINESS_CREATED: "BUSINESS_CREATED",
  BUSINESS_SUSPENDED: "BUSINESS_SUSPENDED",
  BUSINESS_ACTIVATED: "BUSINESS_ACTIVATED",
  BUSINESS_DELETED: "BUSINESS_DELETED",
  BUSINESS_FREE_CHANGED: "BUSINESS_FREE_CHANGED",

  USER_CREATED: "USER_CREATED",
  USER_SUSPENDED: "USER_SUSPENDED",
  USER_ACTIVATED: "USER_ACTIVATED",
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
  ROLE_CHANGED: "ROLE_CHANGED",
  SESSION_REVOKED: "SESSION_REVOKED",

  MODULE_ENABLED: "MODULE_ENABLED",
  MODULE_DISABLED: "MODULE_DISABLED",

  PLAN_CHANGED: "PLAN_CHANGED",
  SUBSCRIPTION_EXTENDED: "SUBSCRIPTION_EXTENDED",
  SUBSCRIPTION_CHANGED: "SUBSCRIPTION_CHANGED",

  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  PAYMENT_REJECTED: "PAYMENT_REJECTED",

  SUPPORT_TICKET_CREATED: "SUPPORT_TICKET_CREATED",
  SUPPORT_TICKET_UPDATED: "SUPPORT_TICKET_UPDATED",

  FEATURE_FLAG_CHANGED: "FEATURE_FLAG_CHANGED",
  SETTINGS_CHANGED: "SETTINGS_CHANGED",
  DATA_EXPORT: "DATA_EXPORT",

  IMPERSONATION_START: "IMPERSONATION_START",
  IMPERSONATION_END: "IMPERSONATION_END",
  SECURITY_EVENT: "SECURITY_EVENT",
} as const;

export type SaAmal = (typeof SA_AMAL)[keyof typeof SA_AMAL];

/**
 * Amal kodining o'zbekcha nomi. Ro'yxatda 2.0 gacha yozilgan ESKI kodlar ham
 * bor — tarixiy yozuvlar panelda "block" emas, tushunarli nom bilan ko'rinadi.
 */
export const AMAL_LABEL: Record<string, string> = {
  LOGIN: "Tizimga kirdi",
  LOGIN_FAILED: "Kirish urinishi muvaffaqiyatsiz",
  LOGOUT: "Tizimdan chiqdi",
  BUSINESS_CREATED: "Yangi mijoz yaratildi",
  BUSINESS_SUSPENDED: "Mijoz bloklandi",
  BUSINESS_ACTIVATED: "Mijoz blokdan chiqarildi",
  BUSINESS_DELETED: "Bo'sh mijoz o'chirildi",
  BUSINESS_FREE_CHANGED: "Bepul rejim o'zgartirildi",
  USER_CREATED: "Foydalanuvchi yaratildi",
  USER_SUSPENDED: "Foydalanuvchi bloklandi",
  USER_ACTIVATED: "Foydalanuvchi faollashtirildi",
  USER_PASSWORD_RESET: "Parol tiklandi",
  ROLE_CHANGED: "Rol o'zgartirildi",
  SESSION_REVOKED: "Sessiyalar bekor qilindi",
  MODULE_ENABLED: "Modul yoqildi",
  MODULE_DISABLED: "Modul o'chirildi",
  PLAN_CHANGED: "Tarif o'zgartirildi",
  SUBSCRIPTION_EXTENDED: "Obuna muddati uzaytirildi",
  SUBSCRIPTION_CHANGED: "Obuna o'zgartirildi",
  PAYMENT_CONFIRMED: "To'lov tasdiqlandi",
  PAYMENT_REJECTED: "To'lov rad etildi",
  SUPPORT_TICKET_CREATED: "Tiket ochildi",
  SUPPORT_TICKET_UPDATED: "Tiket yangilandi",
  FEATURE_FLAG_CHANGED: "Feature flag o'zgartirildi",
  SETTINGS_CHANGED: "Sozlama o'zgartirildi",
  DATA_EXPORT: "Ma'lumot eksport qilindi",
  IMPERSONATION_START: "Impersonatsiya boshlandi",
  IMPERSONATION_END: "Impersonatsiya tugadi",
  SECURITY_EVENT: "Xavfsizlik hodisasi",
  // --- 2.0 gacha yozilgan kodlar (tarix uchun) ---
  block: "Mijoz bloklandi (eski)",
  unblock: "Mijoz blokdan chiqarildi (eski)",
  extend: "Muddat uzaytirildi (eski)",
  plan_change: "Tarif o'zgartirildi (eski)",
  bepul: "Bepul rejim (eski)",
  tenant_create: "Yangi mijoz (eski)",
  impersonate: "Impersonatsiya (eski)",
  impersonate_exit: "Impersonatsiya tugadi (eski)",
  payment_confirm: "To'lov tasdiqlandi (eski)",
  payment_reject: "To'lov rad etildi (eski)",
  password_reset: "Parol tiklandi (eski)",
  create: "Yaratildi",
  update: "O'zgartirildi",
  delete: "O'chirildi",
  restore: "Tiklandi",
  login: "Tizimga kirdi",
  login_failed: "Kirish urinishi muvaffaqiyatsiz",
};

export function amalLabel(action: string): string {
  return AMAL_LABEL[action] ?? action;
}

/**
 * SABABI MAJBURIY amallar (talab 46). Bu ro'yxat guard uchun ham, UI uchun ham
 * yagona manba: forma sababni so'raydi, server esa sababsiz so'rovni rad etadi.
 */
export const SABAB_TALAB_QILADI: ReadonlySet<string> = new Set<string>([
  SA_AMAL.BUSINESS_SUSPENDED,
  SA_AMAL.BUSINESS_DELETED,
  SA_AMAL.BUSINESS_FREE_CHANGED,
  SA_AMAL.USER_SUSPENDED,
  SA_AMAL.USER_PASSWORD_RESET,
  SA_AMAL.SESSION_REVOKED,
  SA_AMAL.MODULE_DISABLED,
  SA_AMAL.PLAN_CHANGED,
  SA_AMAL.PAYMENT_REJECTED,
  SA_AMAL.IMPERSONATION_START,
  SA_AMAL.DATA_EXPORT,
  SA_AMAL.FEATURE_FLAG_CHANGED,
]);

export function sababTalabQiladi(amal: string): boolean {
  return SABAB_TALAB_QILADI.has(amal);
}

/** Parol/token kabi sirlar auditga tushmasligi uchun tozalanadigan kalitlar. */
const YASHIRIN = new Set(["parol", "parolHash", "yangiParol", "token", "secret", "authToken"]);

function tozala(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(tozala);
  if (value instanceof Date) return value.toISOString();
  const natija: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    natija[k] = YASHIRIN.has(k) ? "***" : tozala(v);
  }
  return natija;
}

function json(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(tozala(value));
  } catch {
    return null;
  }
}

export interface SuperadminAuditYozuv {
  /** Route guard bergan kontekst — aktor, IP, qurilma. */
  sa: SuperadminCtx;
  amal: SaAmal;
  /** "tenant" | "user" | "module" | "payment" | "subscription" | "flag" | "ticket" | "export" */
  entity: string;
  entityId: string;
  /** Qaysi kompaniyaga tegishli (bo'lsa) — kompaniya kesimidagi jurnal uchun. */
  tenantId?: string | null;
  before?: unknown;
  after?: unknown;
  sabab?: string | null;
}

/**
 * Superadmin amalini jurnalga yozadi.
 *
 * HECH QACHON tashqariga xato tashlamaydi: jurnal yozib bo'lmagani amalni
 * bekor qilmaydi (amal allaqachon bajarilgan bo'lishi mumkin). Buning o'rniga
 * xato server logiga chiqadi.
 */
export async function superadminAudit(yozuv: SuperadminAuditYozuv): Promise<void> {
  const { sa } = yozuv;
  try {
    await rawPrisma.auditLog.create({
      data: {
        tenantId: yozuv.tenantId ?? null,
        businessId: null,
        userId: sa.session.userId,
        // Aktor OCHIQ belgilanadi: jurnalda superadmin amali oddiy foydalanuvchi
        // amalidan darhol ajralib turishi kerak.
        userIsm: `[SUPERADMIN:${sa.superRol}] ${sa.session.ism}`,
        action: yozuv.amal,
        entity: yozuv.entity,
        entityId: yozuv.entityId,
        before: json(yozuv.before),
        after: json(yozuv.after),
        ip: sa.ip,
        userAgent: sa.userAgent,
        sabab: yozuv.sabab ?? null,
      },
    });
  } catch (error) {
    console.error("Superadmin audit yozib bo'lmadi:", error);
  }
}
