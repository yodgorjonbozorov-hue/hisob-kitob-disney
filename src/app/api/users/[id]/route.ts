import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireManager, UnauthorizedError } from "@/lib/auth/guard";
import { updateUserSchema } from "@/lib/validation/user";
import { hashPassword } from "@/lib/auth/password";
import { logAudit, getClientIp } from "@/lib/services/audit";

const USER_SELECT = {
  id: true,
  ism: true,
  login: true,
  rol: true,
  isActive: true,
  createdAt: true,
  businessId: true,
  business: { select: { nomi: true } },
} as const;

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      select: { rol: true, businessId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
    }

    const { parol, businessId, rol, ...rest } = parsed.data;
    const effectiveRol = rol ?? existing.rol;

    // Biznesni rol asosida hal qilamiz: kassir → majburiy biznes; admin/sotuvchi → biznessiz.
    let businessIdData: { businessId?: string | null } = {};
    if (effectiveRol === "CASHIER") {
      const targetBiz = businessId !== undefined ? businessId : existing.businessId;
      if (!targetBiz) {
        return NextResponse.json({ error: "Kassir uchun biznes tanlanishi shart" }, { status: 400 });
      }
      const biz = await prisma.business.findUnique({ where: { id: targetBiz }, select: { id: true } });
      if (!biz) {
        return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
      }
      businessIdData = { businessId: targetBiz };
    } else {
      // admin/sotuvchi barcha bizneslarni ko'radi — biriktirilgan biznes bo'lmaydi.
      businessIdData = { businessId: null };
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(rol !== undefined ? { rol } : {}),
        ...businessIdData,
        ...(parol ? { parolHash: await hashPassword(parol) } : {}),
      },
      select: USER_SELECT,
    });

    await logAudit({
      businessId: updated.businessId,
      userId: user.userId,
      userIsm: user.ism,
      action: "update",
      entity: "user",
      entityId: params.id,
      before: { rol: existing.rol, businessId: existing.businessId },
      after: { rol: updated.rol, businessId: updated.businessId, ...(parol ? { parolChanged: true } : {}) },
      ip: getClientIp(request),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
