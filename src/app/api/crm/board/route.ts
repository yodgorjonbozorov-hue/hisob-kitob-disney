import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { getBoard } from "@/lib/crm/service";

/** Kanban ma'lumoti: bosqichlar + bitimlar (aktiv biznes bo'yicha). */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ stages: [], deals: [] });
    const board = await getBoard(businessId);
    return NextResponse.json(board);
  },
  { module: "CRM" }
);
