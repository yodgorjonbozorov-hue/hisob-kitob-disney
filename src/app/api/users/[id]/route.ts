import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateUserSchema } from "@/lib/validation/user";
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

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, tenant) => {
  const user = tenant.session;
  requireManager(user.rol);

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: params.id },
    select: { rol: true, businessId: true, login: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
  }

  const { parol, businessId, login, roleId, huquqPlus, huquqMinus, ...rest } = parsed.data;
  let { rol } = parsed.data;

  // MAXSUS ROL (PRO): roleId berilsa tizim roli rol.bazaRol'dan sinxronlanadi;
  // null — maxsus roldan chiqarish (joriy/berilgan tizim roli qoladi).
  let roleData: { roleId?: string | null } = {};
  if (roleId !== undefined) {
    requirePro(tenant);
    if (roleId === null) {
      roleData = { roleId: null };
    } else {
      const role = await prisma.role.findFirst({
        where: { id: roleId, deletedAt: null, isActive: true },
        select: { id: true, bazaRol: true },
      });
      if (!role) return NextResponse.json({ error: "Rol topilmadi" }, { status: 404 });
      roleData = { roleId: role.id };
      rol = role.bazaRol as typeof rol;
    }
  }
  let overrideData: { huquqPlus?: string | null; huquqMinus?: string | null } = {};
  if (huquqPlus !== undefined || huquqMinus !== undefined) {
    requirePro(tenant);
    if (huquqPlus !== undefined) {
      overrideData.huquqPlus = huquqPlus?.length ? JSON.stringify(huquqPlus) : null;
    }
    if (huquqMinus !== undefined) {
      overrideData.huquqMinus = huquqMinus?.length ? JSON.stringify(huquqMinus) : null;
    }
  }

  // Login BUTUN tizim bo'ylab unique — shuning uchun rawPrisma (tenantlar aro tekshiruv).
  if (login !== undefined && login !== existing.login) {
    const band = await rawPrisma.user.findUnique({ where: { login }, select: { id: true } });
    if (band) {
      return NextResponse.json({ error: "Bu login band" }, { status: 409 });
    }
  }
  const effectiveRol = rol ?? existing.rol;

  // Biznesni rol asosida hal qilamiz:
  //  - CASHIER → majburiy biznes.
  //  - SELLER → ixtiyoriy biznes (biriktirilsa yozuvlari doim shu biznesga tushadi).
  //  - OWNER/ADMIN → biznessiz (barcha bizneslar).
  let businessIdData: { businessId?: string | null } = {};
  if (effectiveRol === "CASHIER" || effectiveRol === "SELLER") {
    const targetBiz = businessId !== undefined ? businessId : existing.businessId;
    if (effectiveRol === "CASHIER" && !targetBiz) {
      return NextResponse.json({ error: "Kassir uchun biznes tanlanishi shart" }, { status: 400 });
    }
    if (targetBiz) {
      const biz = await prisma.business.findUnique({ where: { id: targetBiz }, select: { id: true } });
      if (!biz) {
        return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
      }
      businessIdData = { businessId: targetBiz };
    } else {
      businessIdData = { businessId: null };
    }
  } else {
    businessIdData = { businessId: null };
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(rol !== undefined ? { rol } : {}),
      ...(login !== undefined && login !== existing.login ? { login } : {}),
      ...businessIdData,
      ...roleData,
      ...overrideData,
      ...(parol ? { parolHash: await hashPassword(parol) } : {}),
    },
    select: USER_SELECT,
  });

  return NextResponse.json(updated);
});

/**
 * Foydalanuvchini butunlay o'chirish — faqat direktor. O'zini o'chira olmaydi.
 * Yozuvlari (tranzaksiya) bo'lsa — o'chirilmaydi (data yo'qolmasin), o'rniga
 * "Nofaollashtirish" tavsiya qilinadi. Yozuvi yo'q bo'lsa — butunlay o'chiriladi.
 */
export const DELETE = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);
  const id = params.id;

  if (id === user.userId) {
    return NextResponse.json({ error: "O'zingizni o'chira olmaysiz" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, ism: true, login: true } });
  if (!target) return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });

  const txCount = await prisma.transaction.count({ where: { userId: id } });
  if (txCount > 0) {
    return NextResponse.json(
      {
        error: `Bu foydalanuvchida ${txCount} ta yozuv bor. O'chirib bo'lmaydi — tarix saqlanishi kerak. Uni "Nofaollashtiring" (kirolmaydi, lekin yozuvlari qoladi).`,
      },
      { status: 409 }
    );
  }

  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    // Foydalanuvchi boshqa yozuvlarga bog'langan bo'lishi mumkin — 500 o'rniga do'stona xabar.
    console.error("User delete xatosi:", e);
    return NextResponse.json(
      {
        error:
          "Bu foydalanuvchini butunlay o'chirib bo'lmadi (u boshqa yozuvlarga bog'langan bo'lishi mumkin). Uni \"Nofaollashtiring\" — u kirolmaydi, lekin tarixi saqlanadi.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
});
