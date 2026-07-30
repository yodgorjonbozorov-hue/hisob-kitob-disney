import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { logSuperadminAction } from "@/lib/superadmin/service";
import { setDemoRequestStatus, DEMO_STATUSLAR } from "@/lib/services/demoRequest";

const schema = z.object({ status: z.enum(DEMO_STATUSLAR) });

/** Demo so'rovi holatini yangilash (YANGI -> BOGLANILDI -> YOPILDI). */
export const PATCH = withSuperadmin<{ params: { id: string } }>(async (request, { params }, session) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Holat noto'g'ri" }, { status: 400 });
  }

  await setDemoRequestStatus(params.id, parsed.data.status);
  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "demo_request_status",
    entity: "demoRequest",
    entityId: params.id,
    detail: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true });
});
