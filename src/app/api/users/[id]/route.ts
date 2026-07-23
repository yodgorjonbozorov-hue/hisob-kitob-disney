import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { updateUserSchema } from "@/lib/validation/user";
import { hashPassword } from "@/lib/auth/password";

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
    requireRole(user.rol, "admin");

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const { parol, businessId, ...rest } = parsed.data;

    // Biznes o'zgartirilsa — mavjudligini tekshiramiz (dangling reference bo'lmasin).
    if (businessId !== undefined && businessId !== null) {
      const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } });
      if (!biz) {
        return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(businessId !== undefined ? { businessId } : {}),
        ...(parol ? { parolHash: await hashPassword(parol) } : {}),
      },
      select: USER_SELECT,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
