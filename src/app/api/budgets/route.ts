import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireManager, ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { z } from "zod";

const schema = z.object({
  categoryId: z.string().min(1),
  oy: z.string().regex(/^\d{4}-\d{2}$/, "Oy formati noto'g'ri"),
  limitSumma: z.number().int().min(0),
});

/** Kategoriya oylik budjet limitini o'rnatadi (upsert). limitSumma=0 → o'chiradi. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    // Kategoriya shu biznesga tegishli bo'lishi kerak.
    const cat = await prisma.category.findUnique({
      where: { id: parsed.data.categoryId },
      select: { businessId: true },
    });
    if (!cat || cat.businessId !== businessId) {
      throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
    }

    if (parsed.data.limitSumma === 0) {
      await prisma.budget.deleteMany({ where: { categoryId: parsed.data.categoryId, oy: parsed.data.oy } });
      return NextResponse.json({ ok: true, limitSumma: 0 });
    }

    const budget = await prisma.budget.upsert({
      where: { categoryId_oy: { categoryId: parsed.data.categoryId, oy: parsed.data.oy } },
      update: { limitSumma: parsed.data.limitSumma },
      create: {
        businessId,
        categoryId: parsed.data.categoryId,
        oy: parsed.data.oy,
        limitSumma: parsed.data.limitSumma,
      },
    });

    return NextResponse.json({ ok: true, limitSumma: budget.limitSumma });
  } catch (error) {
    return handleApiError(error);
  }
}
