import { rawPrisma } from "./rawPrisma";
import { currentAktor } from "./tenantContext";

/**
 * AVTOMATIK AUDIT YOZUVCHISI.
 *
 * Nega route'da emas: audit 66 route'dan atigi 8 tasida qo'lda chaqirilardi —
 * sotuv, qarz to'lovi, foydalanuvchi yaratish, kategoriya, narx o'zgarishi va
 * boshqalar umuman yozilmasdi. ERP'da audit shartnomaviy talab, shuning uchun
 * u tenant extension'iga (lib/db/tenantDb.ts) ko'chirildi: endi har
 * `create/update/delete/updateMany/deleteMany` avtomatik ushlanadi va yangi
 * route yozganda "audit qo'shishni unutish" imkonsiz.
 *
 * Yozuv `rawPrisma` orqali qilinadi:
 *  - extension ichida extension'ni qayta chaqirmaslik (cheksiz sikl),
 *  - `create`dagi businessId tekshiruvi uchun qo'shimcha so'rov ketmasligi.
 */

/**
 * Audit amallari.
 *
 * "skip" — amal ATAYLAB bajarilmadi (masalan takroriy yozuv tasdiqlangan
 * kunga tushgani uchun o'tkazib yuborildi). Bu xato emas, qaror; shuning
 * uchun u ham jurnalda ko'rinishi kerak — aks holda "nega bu oy ijara
 * yozilmagan?" degan savolga javob topilmasdi.
 */
export type AuditAmal = "create" | "update" | "delete" | "restore" | "skip";

/** Audit yozuviga tushmaydigan maydonlar (sir yoki shovqin). */
const YASHIRIN_MAYDONLAR = new Set(["parolHash", "parol", "linkCode", "linkCodeExpiresAt"]);

/** Yozuvdan audit uchun xavfsiz nusxa oladi: parol hash va shu kabilar chiqarib tashlanadi. */
export function auditUchunTozala(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(auditUchunTozala);
  if (value instanceof Date) return value.toISOString();
  const natija: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (YASHIRIN_MAYDONLAR.has(k)) {
      natija[k] = "***";
      continue;
    }
    natija[k] = auditUchunTozala(v);
  }
  return natija;
}

function json(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(auditUchunTozala(value));
  } catch {
    return null;
  }
}

export interface AuditYozuv {
  tenantId: string | null;
  businessId?: string | null;
  amal: AuditAmal;
  /** Model nomi kichik harf bilan: "transaction", "sale", "category"... */
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Audit yozuvini yozadi. HECH QACHON tashqariga xato tashlamaydi —
 * jurnal yozib bo'lmagani foydalanuvchi amalini buzmasligi kerak.
 */
export async function auditYoz(yozuv: AuditYozuv): Promise<void> {
  try {
    const aktor = currentAktor();
    await rawPrisma.auditLog.create({
      data: {
        tenantId: yozuv.tenantId,
        businessId: yozuv.businessId ?? null,
        userId: aktor?.userId ?? null,
        userIsm: aktor?.ism ?? null,
        action: yozuv.amal,
        entity: yozuv.entity,
        entityId: yozuv.entityId,
        before: json(yozuv.before),
        after: json(yozuv.after),
        ip: aktor?.ip ?? null,
      },
    });
  } catch (error) {
    console.error("Audit yozib bo'lmadi:", error);
  }
}

/** Model nomidan audit `entity` qiymati: "Transaction" -> "transaction". */
export function entityNomi(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}
