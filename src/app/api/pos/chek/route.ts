import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { forbidSeller } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireMagazin } from "@/lib/business";
import { posSotuvSchema } from "@/lib/validation/pos";
import { posSotuv } from "@/lib/services/pos";
import { listPosCheklar } from "@/lib/queries/pos";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { dashboardYangilandi } from "@/lib/cache";

/** Kassa tarixi — oxirgi cheklar. */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    forbidSeller(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    await requireMagazin(businessId);
    return NextResponse.json(await listPosCheklar(businessId));
  },
  { module: "MAGAZIN" }
);

/** Savatni sotish — bitta atomik amal (lib/services/pos.ts). */
export const POST = withTenant(
  async (request, _ctx, tenantCtx) => {
    const user = tenantCtx.session;
    forbidSeller(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireMagazin(businessId);

    const parsed = posSotuvSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    // Mijoz kartochkasi faqat MIJOZLAR moduli yoqiq bo'lsa yaratiladi —
    // o'chirilgan modul uchun ma'lumot to'planmasin (/api/debts bilan bir xil qoida).
    const mijozlarModuli = await isModuleOnForTenant(tenantCtx.tenantId, "MIJOZLAR");

    const chek = await posSotuv({
      businessId,
      satrlar: parsed.data.satrlar,
      tolovTuri: parsed.data.tolovTuri,
      accountId: parsed.data.accountId,
      contactId: parsed.data.contactId,
      mijozNomi: parsed.data.mijozNomi,
      mijozTel: parsed.data.mijozTel,
      mijozSaqla: mijozlarModuli,
      sana: parsed.data.sana,
      userId: user.userId,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json(chek, { status: 201 });
  },
  { module: "MAGAZIN" }
);
