import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

export type AuditAction = "create" | "update" | "delete" | "restore";
export type AuditEntity = "transaction" | "user" | "category" | "sale" | "debt" | "business" | "budget";

interface AuditInput {
  businessId?: string | null;
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
  try {
    await prisma.auditLog.create({
      data: {
        businessId: input.businessId ?? null,
        userId: input.userId ?? null,
        userIsm: input.userIsm ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: input.before !== undefined ? JSON.stringify(input.before) : null,
        after: input.after !== undefined ? JSON.stringify(input.after) : null,
        ip: input.ip ?? null,
      },
    });
  } catch (e) {
    console.error("Audit log yozib bo'lmadi:", e);
  }
}
