import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { dashboardYangilandi } from "@/lib/cache";
import { kunlikSinxron } from "@/lib/services/kunlik";

/** O'chirilgan tranzaksiyani tiklaydi (undo yoki savatdan). */
export const POST = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);

  const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Tranzaksiya topilmadi" }, { status: 404 });
  }
  if (existing.businessId !== businessId) {
    throw new ForbiddenError("Bu yozuv boshqa biznesga tegishli");
  }
  requireOwnerOrAdmin(user.rol, user.userId, existing.userId);

  const restored = await prisma.transaction.update({
    where: { id: params.id },
    // `deletedBy` ham tozalanadi: yozuv endi o'chirilgan emas, "kim
    // o'chirgani" osilib qolsa savat ekrani yolg'on ko'rsatardi. Tarix
    // yo'qolmaydi — u audit jurnalida (o'chirish ham, tiklash ham).
    data: { deletedAt: null, deletedBy: null },
    include: {
      category: true,
      user: { select: { id: true, ism: true } },
      account: { select: { id: true, nomi: true, turi: true } },
    },
  });

  // Tiklangan yozuv hali ham bugungi kirim bo'lsa — kunlikka qaytadi.
  await kunlikSinxron(restored, restored.user.ism);

  dashboardYangilandi(existing.businessId);
  return NextResponse.json(restored);
});
