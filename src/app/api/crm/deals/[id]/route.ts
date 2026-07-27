import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { ForbiddenError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { moveDeal } from "@/lib/crm/service";
import { z } from "zod";

/** Bitim tafsiloti + faoliyat tarixi (timeline). */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    const deal = await prisma.deal.findFirst({
      where: { id: params.id, businessId: businessId ?? "-", deletedAt: null },
      include: {
        contact: true,
        stage: true,
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!deal) return NextResponse.json({ error: "Bitim topilmadi" }, { status: 404 });
    return NextResponse.json(deal);
  },
  { module: "CRM" }
);

const patchSchema = z.object({
  stageId: z.string().optional(),
  kirimYoz: z.boolean().optional(),
  nomi: z.string().trim().min(1).max(200).optional(),
  summa: z.number().int().min(0).optional(),
  izoh: z.string().max(1000).optional().nullable(),
});

/** Bitimni tahrirlash / bosqichga ko'chirish (WON + kirimYoz -> MOLIYA'ga kirim). */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    const data = parsed.data;

    if (data.stageId) {
      await moveDeal({ businessId, dealId: params.id, stageId: data.stageId, kirimYoz: data.kirimYoz, userId: user.userId });
    }

    if (data.nomi !== undefined || data.summa !== undefined || data.izoh !== undefined) {
      const existing = await prisma.deal.findFirst({ where: { id: params.id, businessId, deletedAt: null }, select: { id: true } });
      if (!existing) throw new ForbiddenError("Bitim topilmadi");
      await prisma.deal.update({
        where: { id: params.id },
        data: {
          ...(data.nomi !== undefined ? { nomi: data.nomi } : {}),
          ...(data.summa !== undefined ? { summa: data.summa } : {}),
          ...(data.izoh !== undefined ? { izoh: data.izoh } : {}),
        },
      });
    }

    const deal = await prisma.deal.findFirst({
      where: { id: params.id, businessId },
      include: { contact: { select: { ism: true, tel: true } }, stage: true },
    });
    return NextResponse.json(deal);
  },
  { module: "CRM" }
);
