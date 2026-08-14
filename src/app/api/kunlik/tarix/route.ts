import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { ForbiddenError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listKunlikTarix } from "@/lib/queries/kunlik";
import { getKunlikRuxsat } from "@/lib/services/kunlik";

/**
 * GET /api/kunlik/tarix — oldingi kunlar ro'yxati.
 * Faqat direktor va boshqaruvchilar (xodim faqat bugunni ko'radi).
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);

    const ruxsat = await getKunlikRuxsat(businessId, {
      userId: user.userId,
      ism: user.ism,
      rol: user.rol,
    });
    if (!ruxsat.tarixniKoradi) throw new ForbiddenError("Tarixni ko'rish huquqi yo'q");

    return NextResponse.json(await listKunlikTarix(businessId));
  },
  { module: "KUNLIK" }
);
