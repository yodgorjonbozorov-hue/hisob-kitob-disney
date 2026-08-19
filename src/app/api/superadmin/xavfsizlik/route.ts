import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { xavfsizlikXulosa } from "@/lib/superadmin/xavfsizlik";

export const dynamic = "force-dynamic";

export const GET = withSuperadmin(r("xavfsizlik", "VIEW"), async () =>
  NextResponse.json(await xavfsizlikXulosa())
);
