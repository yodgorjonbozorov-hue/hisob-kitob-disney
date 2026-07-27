import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { createDeal } from "@/lib/crm/service";
import { z } from "zod";

const schema = z.object({
  nomi: z.string().trim().min(1, "Bitim nomi kiritilsin").max(200),
  summa: z.number().int().min(0).optional(),
  contactId: z.string().optional().nullable(),
  kontaktIsm: z.string().trim().max(100).optional().nullable(),
  kontaktTel: z.string().trim().max(30).optional().nullable(),
  muddat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/** Yangi bitim (3 klik: + -> nomi/summa -> saqlash). */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const deal = await createDeal({ businessId, userId: user.userId, ...parsed.data });
    return NextResponse.json(deal, { status: 201 });
  },
  { module: "CRM" }
);
