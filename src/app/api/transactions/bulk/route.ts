import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/auth/roles";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { z } from "zod";
import { dashboardYangilandi } from "@/lib/cache";
import { kunlikBulkUz } from "@/lib/services/kunlik";
import { qarzsizYozuvlar } from "@/lib/services/yozuvQulfi";

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

  // QARZ TO'LOVI YOZUVLARI O'TKAZIB YUBORILADI (lib/services/yozuvQulfi.ts):
  // ular o'chirilsa kassa kamayib, qarz qoldig'i o'sha-o'sha qolardi. Butun
  // so'rov rad etilmaydi — 50 ta yozuvdan bittasi qarz to'lovi bo'lgani uchun
  // qolgan 49 tasi bloklanib qolmasin; nechtasi o'tkazib yuborilgani javobda.
  const { ruxsat, qulflangan } = await qarzsizYozuvlar(businessId, parsed.data.ids);
  if (ruxsat.length === 0) {
    return NextResponse.json(
      {
        error:
          "Belgilangan yozuvlar qarz to'lovi bilan bog'langan — ularni Moliya bo'limidan bekor qiling",
      },
      { status: 403 }
    );
  }

  const res = await prisma.transaction.updateMany({
    where: {
      id: { in: ruxsat },
      businessId,
      deletedAt: null,
      ...(isManager(user.rol) ? {} : { userId: user.userId }),
    },
    // `deletedBy` — "kim o'chirdi" yozuvning o'zida (bitta o'chirish bilan
    // bir xil qoida, `api/transactions/[id]`).
    data: { deletedAt: new Date(), deletedBy: user.userId },
  });

  // Kunlik hisobotga ulangan tushumlar ham chiqariladi (ochiq kunlardan).
  await kunlikBulkUz(businessId, ruxsat);

  dashboardYangilandi(businessId);
  return NextResponse.json({ ok: true, deleted: res.count, qulflangan });
});
