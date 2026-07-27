import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireOwnerOrAdmin, ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { updateTransactionSchema } from "@/lib/validation/transaction";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { resolveActiveBusinessId } from "@/lib/business";
import { logAudit, getClientIp } from "@/lib/services/audit";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const businessId = await resolveActiveBusinessId(user);

    const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Tranzaksiya topilmadi" }, { status: 404 });
    }
    // Faqat aktiv biznesning yozuvi tahrirlanadi (cross-business himoya).
    if (existing.businessId !== businessId) {
      throw new ForbiddenError("Bu yozuv boshqa biznesga tegishli");
    }
    if (existing.deletedAt) {
      throw new ForbiddenError("O'chirilgan yozuvni tahrirlab bo'lmaydi");
    }
    requireOwnerOrAdmin(user.rol, user.userId, existing.userId);

    const body = await request.json();
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const data = parsed.data;

    // Kategoriya o'zgartirilsa, u ham shu biznesga tegishli bo'lishi kerak.
    if (data.categoryId !== undefined) {
      const cat = await prisma.category.findUnique({
        where: { id: data.categoryId },
        select: { businessId: true },
      });
      if (!cat || cat.businessId !== existing.businessId) {
        throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
      }
    }

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

    await logAudit({
      businessId: existing.businessId,
      userId: user.userId,
      userIsm: user.ism,
      action: "update",
      entity: "transaction",
      entityId: existing.id,
      before: { turi: existing.turi, summa: existing.summa, categoryId: existing.categoryId, sana: existing.sana, izoh: existing.izoh },
      after: { turi: updated.turi, summa: updated.summa, categoryId: updated.categoryId, sana: updated.sana, izoh: updated.izoh },
      ip: getClientIp(request),
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    const permanent = new URL(request.url).searchParams.get("permanent") === "true";

    if (permanent) {
      // Butunlay o'chirish — faqat admin.
      if (user.rol !== "admin") throw new ForbiddenError("Butunlay o'chirish faqat admin uchun");
      await prisma.transaction.delete({ where: { id: params.id } });
      await logAudit({
        businessId: existing.businessId, userId: user.userId, userIsm: user.ism,
        action: "delete", entity: "transaction", entityId: existing.id,
        before: { turi: existing.turi, summa: existing.summa, permanent: true },
        ip: getClientIp(request),
      });
      return NextResponse.json({ ok: true, permanent: true });
    }

    // Soft delete — belgilanadi (undo/savat uchun).
    await prisma.transaction.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
    await logAudit({
      businessId: existing.businessId, userId: user.userId, userIsm: user.ism,
      action: "delete", entity: "transaction", entityId: existing.id,
      before: { turi: existing.turi, summa: existing.summa, categoryId: existing.categoryId },
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
