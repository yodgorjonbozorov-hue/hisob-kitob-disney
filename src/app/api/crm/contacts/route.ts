import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { z } from "zod";

/** Kontaktlar ro'yxati (qidiruv bilan). */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);

    const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
    const contacts = await prisma.contact.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(q ? { OR: [{ ism: { contains: q } }, { tel: { contains: q } }] } : {}),
      },
      include: { _count: { select: { deals: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(contacts);
  },
  { module: "CRM" }
);

const schema = z.object({
  ism: z.string().trim().min(1, "Ism kiritilsin").max(100),
  tel: z.string().trim().max(30).optional().nullable(),
  telegram: z.string().trim().max(50).optional().nullable(),
  izoh: z.string().max(500).optional().nullable(),
});

/** Yangi kontakt. */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const contact = await prisma.contact.create({
      data: { businessId, createdBy: user.userId, ...parsed.data },
    });
    return NextResponse.json(contact, { status: 201 });
  },
  { module: "CRM" }
);
