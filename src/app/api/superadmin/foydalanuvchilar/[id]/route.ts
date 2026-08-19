import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { userTafsiloti } from "@/lib/superadmin/foydalanuvchilar";

export const dynamic = "force-dynamic";

export const GET = withSuperadmin<{ params: { id: string } }>(
  r("foydalanuvchilar", "VIEW"),
  async (_request, { params }) => {
    const tafsilot = await userTafsiloti(params.id);
    if (!tafsilot) return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
    return NextResponse.json(tafsilot);
  }
);
