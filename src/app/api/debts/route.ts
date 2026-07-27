import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { listDebts } from "@/lib/queries/inventory";

/** Qarzdorlik ro'yxati — admin va kassir (o'z biznesi). */
export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);
  await requireOmborli(businessId);

  const debts = await listDebts(businessId);
  return NextResponse.json(debts);
}, { module: "OMBOR" });
