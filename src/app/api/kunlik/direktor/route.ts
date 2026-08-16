import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getKunlikDirektor, listKunlikNomzodlar } from "@/lib/queries/kunlik";
import { setKunlikDirektor } from "@/lib/services/kunlik";
import { setKunlikDirektorSchema } from "@/lib/validation/kunlik";

/**
 * GET — joriy direktor + nomzodlar ro'yxati (boshqaruvchi uchun).
 * PUT — direktorni tayinlash/almashtirish/olib tashlash (faqat boshqaruvchi).
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const [direktor, nomzodlar] = await Promise.all([
      getKunlikDirektor(businessId),
      listKunlikNomzodlar(businessId),
    ]);
    return NextResponse.json({ direktor, nomzodlar });
  },
  { module: "KUNLIK" }
);

export const PUT = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = setKunlikDirektorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    await setKunlikDirektor(businessId, parsed.data.direktorId);
    return NextResponse.json(await getKunlikDirektor(businessId));
  },
  { module: "KUNLIK" }
);
