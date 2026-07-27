import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { z } from "zod";

const schema = z.object({
  categoryId: z.string().min(1),
  oy: z.string().regex(/^\d{4}-\d{2}$/, "Oy formati noto'g'ri"),
  limitSumma: z.number().int().min(0),
});

/** Kategoriya oylik budjet limitini o'rnatadi (upsert). limitSumma=0 → o'chiradi. */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
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

  // Tenant rejimida unique amallar faqat id orqali — shuning uchun upsert emas, find + update/create.
  const existing = await prisma.budget.findFirst({
    where: { categoryId: parsed.data.categoryId, oy: parsed.data.oy },
    select: { id: true },
  });
  const budget = existing
    ? await prisma.budget.update({ where: { id: existing.id }, data: { limitSumma: parsed.data.limitSumma } })
    : await prisma.budget.create({
        data: {
          businessId,
          categoryId: parsed.data.categoryId,
          oy: parsed.data.oy,
          limitSumma: parsed.data.limitSumma,
        },
      });

  return NextResponse.json({ ok: true, limitSumma: budget.limitSumma });
});
