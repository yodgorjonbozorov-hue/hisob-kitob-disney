import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireManager, UnauthorizedError } from "@/lib/auth/guard";
import { createBusinessSchema } from "@/lib/validation/business";
import { getAccessibleBusinesses } from "@/lib/business";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    // Foydalanuvchi kira oladigan bizneslar (admin → barcha faol; kassir → o'ziniki).
    const businesses = await getAccessibleBusinesses(user);
    return NextResponse.json(businesses);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);

    const body = await request.json();
    const parsed = createBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    // Yangi biznes yaratuvchining tenantiga bog'lanadi.
    // Eski (migratsiyagacha ochilgan) sessiyalarda tenantId bo'lmaydi — bazadan olamiz.
    let tenantId = user.tenantId ?? null;
    if (!tenantId) {
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { tenantId: true } });
      tenantId = dbUser?.tenantId ?? null;
    }
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant topilmadi — qaytadan tizimga kiring" }, { status: 400 });
    }

    const business = await prisma.business.create({ data: { ...parsed.data, tenantId } });
    return NextResponse.json(business, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
