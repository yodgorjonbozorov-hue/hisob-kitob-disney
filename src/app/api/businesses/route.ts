import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createBusinessSchema } from "@/lib/validation/business";
import { getAccessibleBusinesses } from "@/lib/business";
import { biznesYarat } from "@/lib/services/biznesYaratish";

export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  // Foydalanuvchi kira oladigan bizneslar (admin → barcha faol; kassir → o'ziniki).
  const businesses = await getAccessibleBusinesses(user);
  return NextResponse.json(businesses);
});

/**
 * Yangi biznes (sozlash oqimi). Barcha qoidalar xizmat qatlamida
 * (lib/services/biznesYaratish.ts) — bu yerda faqat huquq va validatsiya.
 */
export const POST = withTenant(async (request, _ctx, { session: user, tenantId, tenant }) => {
  requireManager(user.rol);

  const body = await request.json();
  const parsed = createBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const business = await biznesYarat(parsed.data, { tenantId, plan: tenant.plan });
  return NextResponse.json(business, { status: 201 });
});
