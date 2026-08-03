import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateUserSchema } from "@/lib/validation/user";
import { hashPassword } from "@/lib/auth/password";
import { logAudit, getClientIp } from "@/lib/services/audit";

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

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: params.id },
    select: { rol: true, businessId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
  }

  const { parol, businessId, rol, ...rest } = parsed.data;
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
      ...businessIdData,
      ...(parol ? { parolHash: await hashPassword(parol) } : {}),
    },
    select: USER_SELECT,
  });

  await logAudit({
    businessId: updated.businessId,
    userId: user.userId,
    userIsm: user.ism,
    action: "update",
    entity: "user",
    entityId: params.id,
    before: { rol: existing.rol, businessId: existing.businessId },
    after: { rol: updated.rol, businessId: updated.businessId, ...(parol ? { parolChanged: true } : {}) },
    ip: getClientIp(request),
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

  await prisma.user.delete({ where: { id } });

  await logAudit({
    businessId: null, userId: user.userId, userIsm: user.ism,
    action: "delete", entity: "user", entityId: id,
    before: { ism: target.ism, login: target.login },
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
});
