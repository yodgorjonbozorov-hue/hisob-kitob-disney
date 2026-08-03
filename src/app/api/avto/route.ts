import { NextResponse } from "next/server";
import { requireManager, forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createAvtoSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireAvto } from "@/lib/business";
import { createAvtoMashina } from "@/lib/services/inventory";

/**
 * Avtoparkka mashina qabul qilish (avto rejimidagi biznes).
 * Bitta amalda: mashina yozuvi + avtoparkka kirim + naqd bo'lsa chiqim,
 * qarzga bo'lsa "beriladigan" qarzdorlik.
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireAvto(businessId);

  const body = await request.json();
  const parsed = createAvtoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const mashina = await createAvtoMashina({
    businessId,
    nomi: parsed.data.nomi,
    olinganNarx: parsed.data.olinganNarx,
    sotuvNarx: parsed.data.sotuvNarx,
    avtoYil: parsed.data.avtoYil,
    avtoRaqam: parsed.data.avtoRaqam,
    avtoRang: parsed.data.avtoRang,
    izoh: parsed.data.izoh,
    tolovTuri: parsed.data.tolovTuri,
    egasiNomi: parsed.data.egasiNomi,
    egasiTel: parsed.data.egasiTel,
    userId: user.userId,
  });

  return NextResponse.json(mashina, { status: 201 });
}, { module: "OMBOR" });
