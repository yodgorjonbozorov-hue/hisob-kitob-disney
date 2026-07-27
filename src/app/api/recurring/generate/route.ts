import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { generateDueRecurring } from "@/lib/services/recurring";

/** Muddati kelgan takroriy tranzaksiyalarni qo'lda yaratish (admin). */
export const POST = withTenant(async (_request, _ctx, { session: user }) => {
  requireManager(user.rol);
  const count = await generateDueRecurring();
  return NextResponse.json({ ok: true, count });
});
