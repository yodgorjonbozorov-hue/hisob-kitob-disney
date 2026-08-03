import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateBusinessSchema } from "@/lib/validation/business";

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);

  const body = await request.json();
  const parsed = updateBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Avto rejimi ombor tizimisiz ishlamaydi — birga yoqiladi.
  const omborli = parsed.data.turi === "avto" ? { omborli: true } : {};
  const business = await prisma.business.update({
    where: { id: params.id },
    data: { ...parsed.data, ...omborli },
  });

  return NextResponse.json(business);
});
