import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { getBoard } from "@/lib/crm/service";

/**
 * Kanban ma'lumoti: bosqichlar + bitimlar (aktiv biznes bo'yicha).
 * `?sotuvchiId=` — CRM sotuvchi filtri (25-talab), saralash bazada.
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ stages: [], deals: [], sotuvchilar: {} });
    const sotuvchiId = new URL(request.url).searchParams.get("sotuvchiId");
    const board = await getBoard(businessId, sotuvchiId);
    // Map JSON'ga tushmaydi — oddiy obyektga aylantiriladi.
    return NextResponse.json({
      stages: board.stages,
      deals: board.deals,
      sotuvchilar: Object.fromEntries(board.sotuvchilar),
    });
  },
  { module: "CRM" }
);
