import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { createClientTenant } from "@/lib/superadmin/newClient";
import { logSuperadminAction } from "@/lib/superadmin/service";
import { z } from "zod";

const schema = z.object({
  nom: z.string().trim().min(2, "Kompaniya nomi kamida 2 belgi").max(100),
  login: z.string().trim().min(3, "Login kamida 3 belgi").max(50),
  parol: z.string().min(8, "Parol kamida 8 belgi bo'lishi kerak").max(100),
  ism: z.string().trim().max(100).optional().nullable(),
  tarif: z.string().min(1),
  turi: z.enum(["umumiy", "avto"]),
  kunlar: z.number().int().min(0).max(366),
});

/** Yangi mijoz (tenant) yaratish — SUPERADMIN paneli. */
export const POST = withSuperadmin(async (request, _ctx, session) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const { tenant, user, business, plan, periodEnd } = await createClientTenant({
    nom: parsed.data.nom,
    login: parsed.data.login,
    parol: parsed.data.parol,
    ism: parsed.data.ism,
    tarif: parsed.data.tarif,
    turi: parsed.data.turi,
    kunlar: parsed.data.kunlar,
  });

  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "tenant_create",
    entity: "tenant",
    entityId: tenant.id,
    // Parol jurnaliga YOZILMAYDI.
    detail: { nom: tenant.name, login: user.login, tarif: plan.code, turi: business.turi, kunlar: parsed.data.kunlar },
  });

  return NextResponse.json(
    {
      ok: true,
      tenantId: tenant.id,
      nom: tenant.name,
      login: user.login,
      tarif: plan.code,
      turi: business.turi,
      muddat: periodEnd,
    },
    { status: 201 }
  );
});
