import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireOwnerOrAdmin, ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { logAudit, getClientIp } from "@/lib/services/audit";

/** O'chirilgan tranzaksiyani tiklaydi (undo yoki savatdan). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
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

    return NextResponse.json(restored);
  } catch (error) {
    return handleApiError(error);
  }
}
