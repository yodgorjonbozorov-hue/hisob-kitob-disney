import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createUserSchema } from "@/lib/validation/user";
import { hashPassword } from "@/lib/auth/password";

const USER_SELECT = {
  id: true,
  ism: true,
  login: true,
  rol: true,
  isActive: true,
  createdAt: true,
  businessId: true,
  business: { select: { nomi: true } },
} as const;

export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
});

export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Kassir uchun biznes majburiy; owner/seller uchun biznes yo'q (tenant ichidagi barcha bizneslar).
  let businessId: string | null = null;
  if (parsed.data.rol === "CASHIER") {
    if (!parsed.data.businessId) {
      return NextResponse.json({ error: "Kassir uchun biznes tanlanishi shart" }, { status: 400 });
    }
    // Tenant-scoped client: boshqa tenant biznesi bu yerda ko'rinmaydi (null qaytadi).
    const biz = await prisma.business.findUnique({ where: { id: parsed.data.businessId }, select: { id: true } });
    if (!biz) {
      return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    }
    businessId = biz.id;
  }

  // Login BUTUN tizim bo'ylab unique — shuning uchun rawPrisma (tenantlar aro tekshiruv).
  const existing = await rawPrisma.user.findUnique({ where: { login: parsed.data.login } });
  if (existing) {
    return NextResponse.json({ error: "Bu login band" }, { status: 409 });
  }

  const parolHash = await hashPassword(parsed.data.parol);
  const created = await prisma.user.create({
    data: {
      ism: parsed.data.ism,
      login: parsed.data.login,
      parolHash,
      rol: parsed.data.rol,
      businessId,
    },
    select: USER_SELECT,
  });

  return NextResponse.json(created, { status: 201 });
});
