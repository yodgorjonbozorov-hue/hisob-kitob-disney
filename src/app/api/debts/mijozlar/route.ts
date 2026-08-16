import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId } from "@/lib/business";
import { qarzMijozlariTakror } from "@/lib/queries/qarz";

/**
 * Qarz formasidagi mijoz qidiruvi (autocomplete).
 *
 * `/api/mijozlar` dan alohida, chunki u MIJOZLAR moduliga bog'langan —
 * qarz esa modulsiz ham yozilishi kerak. Bu yerdagi manba ikkita: mijoz
 * kartochkalari va oldingi qarzlardagi ism/telefon.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);

  const q = new URL(request.url).searchParams.get("q");
  return NextResponse.json(await qarzMijozlariTakror(businessId, q));
});
