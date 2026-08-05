import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listOyliklar } from "@/lib/queries/hr";
import { oylikHisobla } from "@/lib/services/hr";
import { oylikHisoblaSchema } from "@/lib/validation/hr";
import { currentMonthString } from "@/lib/date";

export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);

    const oy = new URL(request.url).searchParams.get("oy") ?? currentMonthString();
    return NextResponse.json(await listOyliklar(businessId, oy));
  },
  { module: "HR" }
);

/** Hisoblash — pul yozuvi YOZILMAYDI, faqat qoralama vedomost. */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = oylikHisoblaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await oylikHisobla(businessId, user.userId, parsed.data));
  },
  { module: "HR" }
);
