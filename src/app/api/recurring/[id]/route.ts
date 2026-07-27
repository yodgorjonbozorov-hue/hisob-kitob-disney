import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireManager, ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";

async function ensureOwn(id: string, businessId: string) {
  const r = await prisma.recurringTransaction.findUnique({ where: { id }, select: { businessId: true } });
  if (!r) return "notfound";
  if (r.businessId !== businessId) throw new ForbiddenError("Boshqa biznesga tegishli");
  return "ok";
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    if ((await ensureOwn(params.id, businessId)) === "notfound") {
      return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    }

    const body = await request.json();
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : undefined;
    const updated = await prisma.recurringTransaction.update({
      where: { id: params.id },
      data: { ...(isActive !== undefined ? { isActive } : {}) },
    });
    return NextResponse.json({ ok: true, isActive: updated.isActive });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    if ((await ensureOwn(params.id, businessId)) === "notfound") {
      return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
    }
    await prisma.recurringTransaction.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
