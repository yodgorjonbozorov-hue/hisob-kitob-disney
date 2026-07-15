import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireOwnerOrAdmin, UnauthorizedError } from "@/lib/auth/guard";
import { updateTransactionSchema } from "@/lib/validation/transaction";
import { dateOnlyStringToUTCDate } from "@/lib/date";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Tranzaksiya topilmadi" }, { status: 404 });
    }
    requireOwnerOrAdmin(user.rol, user.userId, existing.userId);

    const body = await request.json();
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const data = parsed.data;
    const updated = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        ...(data.turi !== undefined ? { turi: data.turi } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.summa !== undefined ? { summa: data.summa } : {}),
        ...(data.sana !== undefined ? { sana: dateOnlyStringToUTCDate(data.sana) } : {}),
        ...(data.izoh !== undefined ? { izoh: data.izoh } : {}),
        ...(data.filial !== undefined ? { filial: data.filial } : {}),
      },
      include: { category: true, user: { select: { id: true, ism: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Tranzaksiya topilmadi" }, { status: 404 });
    }
    requireOwnerOrAdmin(user.rol, user.userId, existing.userId);

    await prisma.transaction.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
