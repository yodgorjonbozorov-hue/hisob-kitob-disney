import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireManager, ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { z } from "zod";

const schema = z.object({
  categoryId: z.string().min(1),
  turi: z.enum(["kirim", "chiqim"]),
  summa: z.number().int().positive(),
  kun: z.number().int().min(1).max(28),
  izoh: z.string().max(200).optional().nullable(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    const rows = await prisma.recurringTransaction.findMany({
      where: { businessId },
      include: { category: { select: { nomi: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id, turi: r.turi, summa: r.summa, kun: r.kun, izoh: r.izoh,
        isActive: r.isActive, categoryNomi: r.category.nomi, lastGenerated: r.lastGenerated,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

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

    const cat = await prisma.category.findUnique({
      where: { id: parsed.data.categoryId },
      select: { businessId: true, turi: true },
    });
    if (!cat || cat.businessId !== businessId) {
      throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
    }
    if (cat.turi !== parsed.data.turi) {
      return NextResponse.json({ error: "Kategoriya turi mos emas" }, { status: 400 });
    }

    const created = await prisma.recurringTransaction.create({
      data: {
        businessId,
        categoryId: parsed.data.categoryId,
        turi: parsed.data.turi,
        summa: parsed.data.summa,
        kun: parsed.data.kun,
        izoh: parsed.data.izoh ?? null,
      },
      include: { category: { select: { nomi: true } } },
    });
    return NextResponse.json({
      id: created.id, turi: created.turi, summa: created.summa, kun: created.kun,
      izoh: created.izoh, isActive: created.isActive, categoryNomi: created.category.nomi, lastGenerated: null,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
