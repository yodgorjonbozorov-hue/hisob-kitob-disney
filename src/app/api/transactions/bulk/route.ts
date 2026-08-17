import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/auth/roles";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { z } from "zod";
import { dashboardYangilandi } from "@/lib/cache";
import { kunlikBulkUz } from "@/lib/services/kunlik";
import { assertYozuvlarOzgarishi } from "@/lib/services/davrQulfi";

const schema = z.object({ ids: z.array(z.string()).min(1).max(500) });

/** Ommaviy soft-delete. Faqat aktiv biznes va (admin bo'lmasa) o'z yozuvlari. */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Xato ma'lumot" }, { status: 400 });
  }

  // Yopilgan davr qulfi (audit: Critical #4). Avval BARCHA tanlanganlar
  // tekshiriladi: bittasi yopiq davrda bo'lsa hech biri o'chmaydi — yarim
  // bajarilgan ommaviy o'chirishdan yomoni yo'q.
  const tanlangan = await prisma.transaction.findMany({
    where: {
      id: { in: parsed.data.ids },
      businessId,
      deletedAt: null,
      ...(isManager(user.rol) ? {} : { userId: user.userId }),
    },
    select: { sana: true, createdAt: true },
  });
  await assertYozuvlarOzgarishi(businessId, tanlangan, "o'chirish");

  const res = await prisma.transaction.updateMany({
    where: {
      id: { in: parsed.data.ids },
      businessId,
      deletedAt: null,
      ...(isManager(user.rol) ? {} : { userId: user.userId }),
    },
    data: { deletedAt: new Date() },
  });

  // Kunlik hisobotga ulangan tushumlar ham chiqariladi (ochiq kunlardan).
  await kunlikBulkUz(businessId, parsed.data.ids);

  dashboardYangilandi(businessId);
  return NextResponse.json({ ok: true, deleted: res.count });
});
