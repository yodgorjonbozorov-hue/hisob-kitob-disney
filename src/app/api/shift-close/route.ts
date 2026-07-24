import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getExpectedCash } from "@/lib/queries/shift";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { logAudit, getClientIp } from "@/lib/services/audit";
import { z } from "zod";

const schema = z.object({
  sana: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sanalganNaqd: z.number().int().min(0),
  izoh: z.string().max(500).optional().nullable(),
});

/** Kun yakuni: kutilgan (kirim) vs sanalgan naqd, farqni yozadi. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const kutilganNaqd = await getExpectedCash(businessId, parsed.data.sana);
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

    await logAudit({
      businessId, userId: user.userId, userIsm: user.ism,
      action: "create", entity: "sale", entityId: shift.id,
      after: { smena: true, kutilganNaqd, sanalganNaqd: parsed.data.sanalganNaqd, farq },
      ip: getClientIp(request),
    });

    return NextResponse.json({ ok: true, kutilganNaqd, farq });
  } catch (error) {
    return handleApiError(error);
  }
}
