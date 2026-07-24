import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface AuditListParams {
  businessId?: string | null; // null/undefined → barcha bizneslar (super admin ko'rinishi)
  entity?: string | null;
  action?: string | null;
  page?: number;
  pageSize?: number;
}

export async function listAuditLogs(params: AuditListParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 30));

  const where: Prisma.AuditLogWhereInput = {};
  if (params.businessId) where.businessId = params.businessId;
  if (params.entity) where.entity = params.entity;
  if (params.action) where.action = params.action;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export type AuditLogDTO = Awaited<ReturnType<typeof listAuditLogs>>["items"][number];
