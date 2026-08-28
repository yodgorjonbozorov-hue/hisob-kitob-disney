import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { getMenHolati } from "@/lib/queries/davomat";

/**
 * XODIMNING O'ZI: bugungi davomat holati (mobil check-in sahifasi).
 * Faqat sessiya foydalanuvchisiga bog'langan xodim kartochkasi ko'rinadi —
 * boshqa xodim ma'lumotiga yo'l yo'q.
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ xodim: null });
    return NextResponse.json(await getMenHolati(businessId, user.userId));
  },
  { module: "HR" }
);
