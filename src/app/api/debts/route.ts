import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { listDebts } from "@/lib/queries/inventory";

/** Qarzdorlik ro'yxati — admin va kassir (o'z biznesi). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    await requireOmborli(businessId);

    const debts = await listDebts(businessId);
    return NextResponse.json(debts);
  } catch (error) {
    return handleApiError(error);
  }
}
