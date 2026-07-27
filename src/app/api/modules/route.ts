import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { requireRole } from "@/lib/auth/guard";
import { modulByCode } from "@/lib/modules/registry";
import { planByCode } from "@/lib/billing/plans";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(1),
  isActive: z.boolean(),
});

/** Modulni yoqish/o'chirish — faqat OWNER. O'chirishda ma'lumot O'CHMAYDI. */
export const POST = withTenant(async (request, _ctx, ctx) => {
  const { session: user, tenant } = ctx;
  requireRole(user.rol, "OWNER");

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Xato ma'lumot" }, { status: 400 });
  }
  const { code, isActive } = parsed.data;

  const modul = modulByCode(code);
  if (!modul || modul.korinmas) {
    return NextResponse.json({ error: "Noma'lum modul" }, { status: 404 });
  }
  if (modul.core) {
    return NextResponse.json({ error: "Asosiy modulni o'chirib bo'lmaydi" }, { status: 400 });
  }
  const plan = planByCode(tenant.plan);
  if (isActive && !plan?.modullar.includes(code)) {
    return NextResponse.json(
      { error: `"${modul.nomi}" moduli ${plan?.nomi ?? tenant.plan} tarifida mavjud emas` },
      { status: 402 }
    );
  }

  // Tenant rejimida unique amallar faqat id orqali — find + update/create.
  const existing = await prisma.tenantModule.findFirst({ where: { code }, select: { id: true } });
  if (existing) {
    await prisma.tenantModule.update({ where: { id: existing.id }, data: { isActive } });
  } else {
    await prisma.tenantModule.create({ data: { code, isActive } as never });
  }

  return NextResponse.json({ ok: true, code, isActive });
});
