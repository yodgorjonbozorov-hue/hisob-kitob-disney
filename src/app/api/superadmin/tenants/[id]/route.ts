import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { deleteEmptyTenant, logSuperadminAction } from "@/lib/superadmin/service";

/**
 * Bo'sh (xatoga ochilgan takror) kompaniyani o'chirish.
 * Ish ma'lumoti yoki tasdiqlangan to'lovi bo'lsa servis rad etadi.
 */
export const DELETE = withSuperadmin<{ params: { id: string } }>(async (_request, { params }, session) => {
  const { name } = await deleteEmptyTenant(params.id);

  await logSuperadminAction({
    superadminId: session.userId,
    superadminIsm: session.ism,
    action: "delete",
    entity: "tenant",
    entityId: params.id,
    detail: { name },
  });

  return NextResponse.json({ ok: true, name });
});
