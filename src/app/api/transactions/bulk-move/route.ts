import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/auth/roles";
import { ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { logAudit, getClientIp } from "@/lib/services/audit";
import { z } from "zod";
import { dashboardYangilandi } from "@/lib/cache";
import { kunlikBulkUz } from "@/lib/services/kunlik";
import { kategoriyaIdTop } from "@/lib/kategoriyaNom";

const schema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  targetBusinessId: z.string().min(1),
});

/**
 * Tanlangan yozuvlarni joriy (aktiv) biznesdan boshqa biznesga ko'chiradi.
 * Faqat direktor/admin. Kategoriya maqsad biznesda nom+tur bo'yicha topiladi
 * yoki yaratiladi (transaction.category.businessId invarianti saqlanadi).
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

  // Faqat joriy biznesdagi, o'chirilmagan tanlangan yozuvlar.
  const txs = await prisma.transaction.findMany({
    where: { id: { in: ids }, businessId: sourceBusinessId, deletedAt: null },
    select: { id: true, category: { select: { nomi: true, turi: true } } },
  });

  // Kategoriya keshi: "nomi::turi" -> maqsad kategoriya id.
  // (Ilgari ajratgich sifatida NUL bayti ishlatilardi — grep faylni binary deb
  // ko'rardi va ba'zi tool'lar buzilardi.)
  const catCache = new Map<string, string>();
  async function targetCategoryId(nomi: string, turi: string): Promise<string> {
    const key = `${nomi}::${turi}`;
    const cached = catCache.get(key);
    if (cached) return cached;
    // Registrga BEFARQ moslash: maqsad biznesda "bantik" bo'lsa, "Bantik"
    // qayta yaratilmaydi (baza indeksi bunga yo'l ham bermasdi).
    // Yaratish `upsert` — parallel ko'chirishda dublikat kategoriya yaratilmasin.
    const id = await kategoriyaIdTop(
      () =>
        prisma.category.findMany({
          where: { businessId: targetBusinessId, turi },
          select: { id: true, nomi: true },
        }),
      () =>
        prisma.category.upsert({
          where: { nomi_turi_businessId: { nomi, turi, businessId: targetBusinessId } },
          update: {},
          create: { businessId: targetBusinessId, nomi, turi },
          select: { id: true },
        }),
      nomi
    );
    catCache.set(key, id);
    return id;
  }

  // N+1 tuzatildi: ilgari har yozuvga alohida `update` ketardi (500 tagacha
  // ketma-ket so'rov). Endi yozuvlar maqsad kategoriyasi bo'yicha guruhlanadi
  // va har guruh bitta `updateMany` bilan ko'chiriladi.
  const guruhlar = new Map<string, string[]>();
  for (const t of txs) {
    const catId = await targetCategoryId(t.category.nomi, t.category.turi);
    const ro = guruhlar.get(catId);
    if (ro) ro.push(t.id);
    else guruhlar.set(catId, [t.id]);
  }

  let moved = 0;
  for (const [catId, txIds] of guruhlar) {
    const res = await prisma.transaction.updateMany({
      where: { id: { in: txIds }, businessId: sourceBusinessId, deletedAt: null },
      data: { businessId: targetBusinessId, categoryId: catId },
    });
    moved += res.count;
  }

  await logAudit({
    businessId: targetBusinessId, userId: user.userId, userIsm: user.ism,
    action: "update", entity: "transaction", entityId: "bulk-move",
    before: { fromBusinessId: sourceBusinessId },
    after: { toBusinessId: targetBusinessId, count: moved },
    ip: getClientIp(request),
  });

  // Boshqa biznesga ko'chgan yozuv manba biznes kunligidan chiqadi
  // (kunlik — pul tushgan biznesning ko'zgusi).
  await kunlikBulkUz(
    sourceBusinessId,
    txs.map((t) => t.id)
  );

  // Ikkala biznes dashboardi ham o'zgardi.
  dashboardYangilandi(sourceBusinessId);
  dashboardYangilandi(targetBusinessId);
  return NextResponse.json({ ok: true, moved });
});
