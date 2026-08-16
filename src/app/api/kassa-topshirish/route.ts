import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getKassaHolat, listKutilayotganTopshiriqlar } from "@/lib/queries/kassirKassa";
import { kassagaPulBer, topshiriqYarat } from "@/lib/services/kassirKassa";
import { pulBerishSchema, topshirishSchema } from "@/lib/validation/kassirKassa";

/**
 * KASSA TOPSHIRISH API.
 *
 * Bu route MOLIYA hisobotlariga tegmaydi: bu yerda Transaction ham,
 * AccountTransfer ham yozilmaydi (batafsil: lib/services/kassirKassa.ts).
 */

/**
 * GET — o'z kassa holati (`?holat=meniki`, default) yoki direktor uchun
 * tasdiq kutayotgan topshiriqlar (`?holat=kutilmoqda`).
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get("holat") === "kutilmoqda") {
    requireManager(user.rol);
    return NextResponse.json(await listKutilayotganTopshiriqlar(businessId));
  }
  return NextResponse.json(
    await getKassaHolat(businessId, { id: user.userId, ism: user.ism })
  );
});

/**
 * POST — kassani topshirish (har qanday xodim, o'z kassasidan) yoki
 * kassaga pul berish (`turi: "berish"`, faqat direktor/admin).
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const aktor = { userId: user.userId, ism: user.ism, rol: user.rol };

  if (body && typeof body === "object" && body.turi === "berish") {
    const parsed = pulBerishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    // Rol tekshiruvi xizmat qatlamida (kassagaPulBer) — bitta joyda.
    const yozuv = await kassagaPulBer(businessId, aktor, parsed.data);
    return NextResponse.json(yozuv, { status: 201 });
  }

  const parsed = topshirishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }
  const topshiriq = await topshiriqYarat(businessId, aktor, parsed.data);
  return NextResponse.json(topshiriq, { status: 201 });
});
