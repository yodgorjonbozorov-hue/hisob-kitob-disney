import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager, ForbiddenError } from "@/lib/auth/guard";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { listXodimVazifalari, createXodimVazifa } from "@/lib/services/xodimVazifa";
import { vazifaCreateSchema } from "@/lib/validation/hr";

/**
 * Xodim vazifalari ro'yxati (?employeeId=&oy=).
 * Boshqaruvchi — istalgan xodimni; oddiy xodim — FAQAT o'zinikini ko'radi
 * (employeeId serverda `userId` orqali tekshiriladi).
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);

    const params = new URL(request.url).searchParams;
    const employeeId = params.get("employeeId") ?? "";
    if (!employeeId) return NextResponse.json({ error: "employeeId kerak" }, { status: 400 });
    const oyParam = params.get("oy") ?? "";
    const oy = /^\d{4}-\d{2}$/.test(oyParam) ? oyParam : undefined;

    if (!isManager(user.rol)) {
      const ozi = await prisma.employee.findFirst({
        where: { id: employeeId, businessId, userId: user.userId, deletedAt: null },
        select: { id: true },
      });
      if (!ozi) throw new ForbiddenError("Faqat o'z vazifalaringizni ko'ra olasiz");
    }

    return NextResponse.json(await listXodimVazifalari(businessId, employeeId, oy));
  },
  { module: "HR" }
);

/** Yangi vazifa berish — faqat boshqaruvchi. */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = vazifaCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    return NextResponse.json(await createXodimVazifa(businessId, user.userId, parsed.data), {
      status: 201,
    });
  },
  { module: "HR" }
);
