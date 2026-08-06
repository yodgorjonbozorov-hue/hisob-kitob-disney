import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveBusinessId } from "@/lib/business";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { getExpectedCash } from "@/lib/queries/shift";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { z } from "zod";

const schema = z.object({
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sanalganNaqd: z.number().int().min(0),
  izoh: z.string().max(500).optional().nullable(),
});

/** Kun yakuni: kutilgan (kirim) vs sanalgan naqd, farqni yozadi. */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Sahifadagi ko'rsatkich bilan bir xil chegara: kassir — o'z kirimlari bo'yicha.
  const kutilganNaqd = await getExpectedCash(businessId, parsed.data.sana, transactionScopeUserId(user));
  const farq = parsed.data.sanalganNaqd - kutilganNaqd;

  const shift = await prisma.shiftClose.create({
    data: {
      businessId,
      userId: user.userId,
      userIsm: user.ism,
      sana: dateOnlyStringToUTCDate(parsed.data.sana),
      kutilganNaqd,
      sanalganNaqd: parsed.data.sanalganNaqd,
      farq,
      izoh: parsed.data.izoh ?? null,
    },
  });

  return NextResponse.json({ ok: true, kutilganNaqd, farq });
});
