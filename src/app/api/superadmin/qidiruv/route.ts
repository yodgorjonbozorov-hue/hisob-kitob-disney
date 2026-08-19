import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { globalQidiruv } from "@/lib/superadmin/qidiruv";
import { matn } from "@/lib/superadmin/sorovParam";

export const dynamic = "force-dynamic";

/**
 * Global qidiruv (CMD/CTRL + K).
 *
 * Natijalar ROLGA MOS: ko'rish huquqi yo'q turdagi yozuvlar umuman
 * qidirilmaydi — "topilgan, lekin ochib bo'lmaydi" holati yuzaga kelmaydi.
 */
export const GET = withSuperadmin(r("dashboard", "VIEW"), async (request, _ctx, sa) => {
  const q = matn(new URL(request.url).searchParams, "q") ?? "";
  return NextResponse.json({ natijalar: await globalQidiruv(q, sa.superRol) });
});
