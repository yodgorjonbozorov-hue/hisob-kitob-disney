import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { biznesTafsiloti } from "@/lib/superadmin/bizneslar";

export const dynamic = "force-dynamic";

export const GET = withSuperadmin<{ params: { id: string } }>(
  r("bizneslar", "VIEW"),
  async (_request, { params }) => {
    const tafsilot = await biznesTafsiloti(params.id);
    if (!tafsilot) return NextResponse.json({ error: "Kompaniya topilmadi" }, { status: 404 });
    return NextResponse.json(tafsilot);
  }
);
