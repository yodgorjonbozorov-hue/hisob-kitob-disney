import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { generateDueRecurring } from "@/lib/services/recurring";

/** Muddati kelgan takroriy tranzaksiyalarni qo'lda yaratish (admin). */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireRole(user.rol, "admin");
    const count = await generateDueRecurring();
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return handleApiError(error);
  }
}
