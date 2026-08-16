import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { requirePro } from "@/lib/billing/pro";
import { updateRole, deleteRole } from "@/lib/services/rollar";
import { updateRoleSchema } from "@/lib/validation/rol";

/** Rolni tahrirlash (PRO). */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, tenant) => {
    requireManager(tenant.session.rol);
    requirePro(tenant);

    const parsed = updateRoleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await updateRole(params.id, parsed.data));
  }
);

/** Rolni o'chirish — yumshoq (PRO). */
export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, tenant) => {
    requireManager(tenant.session.rol);
    requirePro(tenant);
    return NextResponse.json(await deleteRole(params.id));
  }
);
