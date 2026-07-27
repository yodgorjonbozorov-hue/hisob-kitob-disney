import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { logAudit, getClientIp } from "@/lib/services/audit";
import { z } from "zod";

const schema = z.object({ ids: z.array(z.string()).min(1).max(500) });

/** Ommaviy soft-delete. Faqat aktiv biznes va (admin bo'lmasa) o'z yozuvlari. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Xato ma'lumot" }, { status: 400 });
    }

    const res = await prisma.transaction.updateMany({
      where: {
        id: { in: parsed.data.ids },
        businessId,
        deletedAt: null,
        ...(user.rol === "admin" ? {} : { userId: user.userId }),
      },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      businessId, userId: user.userId, userIsm: user.ism,
      action: "delete", entity: "transaction", entityId: "bulk",
      after: { count: res.count, bulk: true },
      ip: getClientIp(request),
    });

    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (error) {
    return handleApiError(error);
  }
}
