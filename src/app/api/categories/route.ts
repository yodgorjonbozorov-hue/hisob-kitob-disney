import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createCategorySchema } from "@/lib/validation/category";
import { resolveActiveBusinessId } from "@/lib/business";
import { oxirgiKgNarxlari } from "@/lib/queries/selos";

export const GET = withTenant(async (request, _ctx, { session: user }) => {

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);

  const { searchParams } = new URL(request.url);
  const turi = searchParams.get("turi");
  const activeParam = searchParams.get("active");

  const categories = await prisma.category.findMany({
    where: {
      businessId,
      ...(turi === "kirim" || turi === "chiqim" ? { turi } : {}),
      ...(activeParam === "true" ? { isActive: true } : {}),
    },
    orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
  });

  // KG SAVDOSI (mijozga xos): kg oynasi 1 kg narxini oxirgi savdodan
  // taklif qiladi. Bunday kategoriyasi yo'q mijozda qo'shimcha so'rov ham
  // yo'q — javob avvalgidek qaytadi.
  const kgIdlar = categories.filter((c) => c.kgAsosli).map((c) => c.id);
  if (kgIdlar.length === 0) return NextResponse.json(categories);

  const narxlar = await oxirgiKgNarxlari(businessId, kgIdlar);
  return NextResponse.json(
    categories.map((c) => (c.kgAsosli ? { ...c, oxirgiKgNarxi: narxlar[c.id] ?? null } : c))
  );
});

export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Kategoriya aktiv biznes ostida yaratiladi.
  const category = await prisma.category.create({ data: { ...parsed.data, businessId } });
  return NextResponse.json(category, { status: 201 });
});
