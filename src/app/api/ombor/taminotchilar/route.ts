import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listSuppliers } from "@/lib/queries/xarid";
import { createSupplier } from "@/lib/services/xarid";
import { createSupplierSchema } from "@/lib/validation/xarid";
import { requirePro } from "@/lib/billing/pro";

/**
 * TA'MINOTCHILAR — Ombor moduli ostidagi ko'rinish.
 *
 * NEGA `/api/xarid/suppliers` NUSXASI EMAS: reyestr ham, xizmat qatlami ham
 * AYNI BIR (`Supplier` jadvali, `lib/services/xarid.ts`). Faqat modul
 * darvozasi boshqacha — "Tovar keldi" oqimi XARID moduli yoqilmagan
 * bizneslarda ham ishlashi kerak, aks holda gul do'koni ta'minotchi
 * tanlay olmasdi. Ikkinchi jadval ham, ikkinchi haqiqat ham yaratilmaydi.
 *
 * BIZNES IZOLYATSIYASI: `listSuppliers`/`createSupplier` har so'rovda
 * `businessId` sharti bilan ishlaydi va tenant filtri prisma extension'ida —
 * A biznes B biznesning ta'minotchisini na ko'radi, na tanlay oladi.
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    const faqatFaol = new URL(request.url).searchParams.get("faol") !== "0";
    return NextResponse.json(await listSuppliers(businessId, faqatFaol));
  },
  { module: "OMBOR" }
);

export const POST = withTenant(
  async (request, _ctx, tenant) => {
    const user = tenant.session;
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = createSupplierSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    // Ta'minotchini tizim useriga bog'lash — PRO imkoniyati (XARID bilan bir xil qoida).
    if (parsed.data.userId) requirePro(tenant);
    return NextResponse.json(await createSupplier(businessId, parsed.data), { status: 201 });
  },
  { module: "OMBOR" }
);
