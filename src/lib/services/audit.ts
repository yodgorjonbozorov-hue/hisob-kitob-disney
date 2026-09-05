import type { NextRequest } from "next/server";
import { maybeTenantId } from "@/lib/db/tenantContext";
import { auditYoz, type AuditAmal } from "@/lib/db/auditWriter";

/**
 * QO'LDA AUDIT YOZISH.
 *
 * Odatda audit AVTOMATIK yoziladi — `lib/db/tenantDb.ts` extension'i har
 * `create/update/delete/updateMany/deleteMany` amalini ushlaydi. Shu fayl
 * faqat MAXSUS SEMANTIKALI hodisalar uchun qoladi: xom amallar
 * ketma-ketligidan kelib chiqmaydigan biznes voqeasi (masalan "yozuvlar
 * boshqa biznesga ko'chirildi", "sotuv qilindi") yoki tranzaksiya ichidagi
 * (runBusinessTx — extension'dan o'tmaydigan) amallar.
 *
 * Yangi oddiy route yozayotgan bo'lsangiz — bu funksiyani chaqirish SHART EMAS.
 */

export type AuditAction = AuditAmal;

/**
 * Audit sub'ekti. Avtomatik audit model nomini ishlatadi
 * ("transaction", "sale", "shiftClose"...), qo'lda yozishda quyidagi
 * biznes-hodisa nomlari ham mumkin.
 */
export type AuditEntity =
  | "transaction"
  | "user"
  | "role"
  | "category"
  | "sale"
  | "debt"
  | "debtPayment"
  | "business"
  | "budget"
  | "product"
  | "productExpense"
  | "shift"
  | "account"
  | "accountTransfer"
  | "supplier"
  | "purchaseOrder"
  | "approvalRule"
  | "approvalRequest"
  | "contact"
  | "employee"
  | "payroll"
  | "payrollAdvance"
  | "contract"
  | "attachment"
  | "dailyReport"
  | "dailyTransaction"
  | "dailyReportSetting"
  | "smena"
  | "cashHandover"
  // MAGAZIN moduli
  | "posChek"
  | "productCategory"
  // Davomat 2.0
  | "attendance"
  | "employeePenalty"
  | "employeeBonus"
  // CRM: zakaz sotuvchisini almashtirish (kim → kimga, kim o'zgartirdi)
  | "deal"
  // Mijozga Telegram xabarnomasi (qo'lda qayta yuborish)
  | "telegramNotification";

interface AuditInput {
  businessId?: string | null;
  /** Aktor endi kontekstdan olinadi (runWithTenant) — bu maydonlar e'tiborsiz. */
  userId?: string | null;
  userIsm?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/** So'rovdan mijoz IP manzilini oladi (Vercel x-forwarded-for beradi). */
export function getClientIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/**
 * Audit yozuvini yozadi. Asosiy oqimni bloklamaydi — xato bo'lsa jimgina o'tadi
 * (audit yozuv muvaffaqiyatsizligi foydalanuvchi amalini buzmasligi kerak).
 */
export async function logAudit(input: AuditInput): Promise<void> {
  await auditYoz({
    tenantId: maybeTenantId(),
    businessId: input.businessId ?? null,
    amal: input.action,
    entity: input.entity,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
  });
}
