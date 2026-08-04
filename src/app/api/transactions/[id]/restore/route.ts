import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { logAudit, getClientIp } from "@/lib/services/audit";
import { dashboardYangilandi } from "@/lib/cache";

/** O'chirilgan tranzaksiyani tiklaydi (undo yoki savatdan). */
export const POST = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);

  const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Tranzaksiya topilmadi" }, { status: 404 });
  }
  if (existing.businessId !== businessId) {
    throw new ForbiddenError("Bu yozuv boshqa biznesga tegishli");
  }
  requireOwnerOrAdmin(user.rol, user.userId, existing.userId);

  const restored = await prisma.transaction.update({
    where: { id: params.id },
    data: { deletedAt: null },
    include: { category: true, user: { select: { id: true, ism: true } } },
  });

  await logAudit({
    businessId: existing.businessId, userId: user.userId, userIsm: user.ism,
    action: "restore", entity: "transaction", entityId: existing.id,
    ip: getClientIp(request),
  });

  dashboardYangilandi(existing.businessId);
  return NextResponse.json(restored);
});
