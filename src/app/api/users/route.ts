import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createUserSchema } from "@/lib/validation/user";
import { hashPassword } from "@/lib/auth/password";
import { requirePro } from "@/lib/billing/pro";

const USER_SELECT = {
  id: true,
  ism: true,
  login: true,
  rol: true,
  isActive: true,
  createdAt: true,
  businessId: true,
  business: { select: { nomi: true } },
  roleId: true,
  role: { select: { nomi: true, bazaRol: true } },
  huquqPlus: true,
  huquqMinus: true,
} as const;

export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(users);
});

export const POST = withTenant(async (request, _ctx, tenant) => {
  const user = tenant.session;
  requireManager(user.rol);

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // MAXSUS ROL (PRO): tanlangan bo'lsa tizim roli rol.bazaRol'dan olinadi —
  // nav/modul skeleti shu orqali ishlaydi, granular huquqlar esa roldan.
  let roleId: string | null = null;
  let effectiveRol: string = parsed.data.rol;
  if (parsed.data.roleId) {
    requirePro(tenant);
    const role = await prisma.role.findFirst({
      where: { id: parsed.data.roleId, deletedAt: null, isActive: true },
      select: { id: true, bazaRol: true },
    });
    if (!role) return NextResponse.json({ error: "Rol topilmadi" }, { status: 404 });
    roleId = role.id;
    effectiveRol = role.bazaRol;
  }
  if (parsed.data.huquqPlus?.length || parsed.data.huquqMinus?.length) {
    requirePro(tenant);
  }

  // Kassir uchun biznes MAJBURIY; sotuvchi uchun IXTIYORIY (biriktirilsa — yozuvlari
  // doim shu biznesga tushadi; biriktirilmasa — ko'p-biznesli). Owner/admin — biznessiz.
  let businessId: string | null = null;
  if (effectiveRol === "CASHIER" || effectiveRol === "SELLER") {
    if (effectiveRol === "CASHIER" && !parsed.data.businessId) {
      return NextResponse.json({ error: "Kassir uchun biznes tanlanishi shart" }, { status: 400 });
    }
    if (parsed.data.businessId) {
      // Tenant-scoped client: boshqa tenant biznesi bu yerda ko'rinmaydi (null qaytadi).
      const biz = await prisma.business.findUnique({ where: { id: parsed.data.businessId }, select: { id: true } });
      if (!biz) {
        return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
      }
      businessId = biz.id;
    }
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
      rol: effectiveRol,
      businessId,
      roleId,
      huquqPlus: parsed.data.huquqPlus?.length ? JSON.stringify(parsed.data.huquqPlus) : undefined,
      huquqMinus: parsed.data.huquqMinus?.length ? JSON.stringify(parsed.data.huquqMinus) : undefined,
    },
    select: USER_SELECT,
  });

  return NextResponse.json(created, { status: 201 });
});
