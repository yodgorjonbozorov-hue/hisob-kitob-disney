import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { qabulQilish } from "@/lib/services/xarid";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * KUTILAYOTGAN BUYURTMANI QABUL QILISH.
 *
 * "Omborga ta'minot" oqimi ta'minotni bir qadamda yozadi, lekin XARID moduli
 * bilan ilgari yaratilgan QORALAMA/TASDIQLANGAN buyurtmalar bazada qolgan.
 * Ular Ombor ichidagi "Ta'minotlar" tabida "Kutilmoqda" bo'lib ko'rinadi va
 * shu yerdan qabul qilinadi — aks holda mijozning ochiq buyurtmalari
 * yopilmay osilib qolardi.
 *
 * Ombor va pul yozuvlari baribir AYNI BIR joyda (`qabulYozuvlariTx`).
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireOmborli(businessId);

    const order = await qabulQilish({ businessId, orderId: params.id, userId: user.userId });
    dashboardYangilandi(businessId);
    return NextResponse.json(order);
  },
  { module: "OMBOR" }
);
