import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createBusinessSchema } from "@/lib/validation/business";
import { getAccessibleBusinesses } from "@/lib/business";
import { DEFAULT_KASSA_NOMI } from "@/lib/services/accounts";

export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  // Foydalanuvchi kira oladigan bizneslar (admin → barcha faol; kassir → o'ziniki).
  const businesses = await getAccessibleBusinesses(user);
  return NextResponse.json(businesses);
});

export const POST = withTenant(async (request, _ctx, { session: user, tenantId }) => {
  requireManager(user.rol);

  const body = await request.json();
  const parsed = createBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Avto rejimi ombor tizimisiz ishlamaydi — birga yoqiladi.
  const omborli = parsed.data.turi === "avto" ? { omborli: true } : {};
  // tenantId kontekstdan — extension ham xuddi shu qiymatni majburlaydi (lib/db/tenantDb.ts).
  const business = await prisma.business.create({ data: { ...parsed.data, ...omborli, tenantId } });

  // Har biznesda kamida bitta kassa bo'lishi shart, aks holda yozuv qayerga
  // tushishini ko'rsatib bo'lmaydi (signup'dagi bilan bir xil qoida).
  await prisma.account.create({
    data: { businessId: business.id, nomi: DEFAULT_KASSA_NOMI, turi: "naqd", tartib: 0 },
  });

  return NextResponse.json(business, { status: 201 });
});
