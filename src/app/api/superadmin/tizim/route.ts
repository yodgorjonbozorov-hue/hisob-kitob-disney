import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { tizimSoglik, bazaOlchovlari } from "@/lib/superadmin/tizim";

export const dynamic = "force-dynamic";

/** Tizim sog'lig'i va baza o'lchovlari. Xavfli SQL bu yerdan ISHGA TUSHMAYDI. */
export const GET = withSuperadmin(r("tizim", "VIEW"), async () => {
  const [soglik, olchovlar] = await Promise.all([tizimSoglik(), bazaOlchovlari()]);
  return NextResponse.json({ soglik, olchovlar });
});
