import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { updateSupplier, deleteSupplier } from "@/lib/services/xarid";
import { updateSupplierSchema } from "@/lib/validation/xarid";
import { requirePro } from "@/lib/billing/pro";

/**
 * Bitta ta'minotchini tahrirlash / o'chirish.
 *
 * `/api/xarid/suppliers/[id]` bilan AYNI xizmat qatlamini chaqiradi — farqi
 * faqat modul darvozasida (OMBOR). Ta'minotchilar reyestri Ombor ostiga
 * ko'chgani uchun rejali xarid moduli yoqilmagan biznes ham uni yurita
 * olishi kerak.
 */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, tenant) => {
    const user = tenant.session;
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = updateSupplierSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    // Tizim useriga bog'lash — PRO imkoniyati (uzish PRO'siz ham mumkin).
    if (parsed.data.userId) requirePro(tenant);
    return NextResponse.json(await updateSupplier(businessId, params.id, parsed.data));
  },
  { module: "OMBOR" }
);

export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    return NextResponse.json(await deleteSupplier(businessId, params.id));
  },
  { module: "OMBOR" }
);
