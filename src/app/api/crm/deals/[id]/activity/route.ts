import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { z } from "zod";

const schema = z.object({
  turi: z.enum(["izoh", "qongiroq", "uchrashuv"]).default("izoh"),
  matn: z.string().trim().min(1, "Matn kiritilsin").max(1000),
});

/** Bitimga faoliyat qo'shish (tez izoh, qo'ng'iroq, uchrashuv). */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const deal = await prisma.deal.findFirst({
      where: { id: params.id, businessId, deletedAt: null },
      select: { id: true, contactId: true },
    });
    if (!deal) return NextResponse.json({ error: "Bitim topilmadi" }, { status: 404 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const activity = await prisma.activity.create({
      data: {
        businessId,
        dealId: deal.id,
        contactId: deal.contactId,
        turi: parsed.data.turi,
        matn: parsed.data.matn,
        userId: user.userId,
      },
    });
    return NextResponse.json(activity, { status: 201 });
  },
  { module: "CRM" }
);
