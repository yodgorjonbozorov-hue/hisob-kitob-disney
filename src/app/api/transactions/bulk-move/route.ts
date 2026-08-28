import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/auth/roles";
import { ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { logAudit, getClientIp } from "@/lib/services/audit";
import { z } from "zod";
import { dashboardYangilandi } from "@/lib/cache";
import { tranzaksiyalarniKochir } from "@/lib/services/tranzaksiyaKochirish";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  targetBusinessId: z.string().min(1),
});

/**
 * Tanlangan yozuvlarni joriy (aktiv) biznesdan boshqa biznesga ko'chiradi.
 * Faqat direktor/admin. Ko'chirish mantiqi (kategoriya moslash, kassani
 * maqsad biznesga qayta bog'lash) — `lib/services/tranzaksiyaKochirish.ts`.
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  if (!isManager(user.rol)) {
    throw new ForbiddenError("Yozuvlarni ko'chirish faqat direktor uchun");
  }

  const sourceBusinessId = await resolveActiveBusinessId(user);
  if (!sourceBusinessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Xato ma'lumot" }, { status: 400 });
  }
  const { ids, targetBusinessId } = parsed.data;

  if (targetBusinessId === sourceBusinessId) {
    return NextResponse.json({ error: "Maqsad biznes joriy biznes bilan bir xil" }, { status: 400 });
  }
  // Maqsad biznes shu tenantda mavjudmi (tenant-scoped — boshqa tenant ko'rinmaydi).
  const target = await prisma.business.findUnique({ where: { id: targetBusinessId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "Maqsad biznes topilmadi" }, { status: 404 });

  const moved = await tranzaksiyalarniKochir(sourceBusinessId, targetBusinessId, ids);

  await logAudit({
    businessId: targetBusinessId, userId: user.userId, userIsm: user.ism,
    action: "update", entity: "transaction", entityId: "bulk-move",
    before: { fromBusinessId: sourceBusinessId },
    after: { toBusinessId: targetBusinessId, count: moved },
    ip: getClientIp(request),
  });

  // Ikkala biznes dashboardi ham o'zgardi.
  dashboardYangilandi(sourceBusinessId);
  dashboardYangilandi(targetBusinessId);
  return NextResponse.json({ ok: true, moved });
});
