import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { createSaleSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { createSale } from "@/lib/services/inventory";
import { listRecentSales } from "@/lib/queries/inventory";
import { dashboardYangilandi } from "@/lib/cache";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { hasPermission } from "@/lib/permissions/tekshir";

export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);
  await requireOmborli(businessId);

  // KO'RINUVCHANLIK (lib/auth/visibility.ts qoidasi bilan bir xil): hisobot
  // huquqi bo'lmagan xodim butun biznesning sotuvlarini emas, FAQAT o'zi
  // rasmiylashtirganini ko'radi.
  const hammasi = await hasPermission(user.userId, "hisobot.korish");
  const sales = await listRecentSales(businessId, 20, hammasi ? null : user.userId);
  return NextResponse.json(sales);
}, { module: "OMBOR" });

/** Sotuv — admin va kassir. */
export const POST = withTenant(async (request, _ctx, tenantCtx) => {
  const user = tenantCtx.session;
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  const body = await request.json();
  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Mijoz kartochkasi faqat MIJOZLAR moduli yoqiq bo'lsa yaratiladi
  // (/api/debts va /api/pos/chek bilan bir xil qoida).
  const mijozlarModuli = await isModuleOnForTenant(tenantCtx.tenantId, "MIJOZLAR");

  const sale = await createSale({
    businessId,
    productId: parsed.data.productId,
    miqdor: parsed.data.miqdor,
    tolovTuri: parsed.data.tolovTuri,
    contactId: parsed.data.contactId,
    mijozNomi: parsed.data.mijozNomi,
    mijozTel: parsed.data.mijozTel,
    mijozSaqla: mijozlarModuli,
    narx: parsed.data.narx,
    accountId: parsed.data.accountId,
    sana: parsed.data.sana,
    userId: user.userId,
  });

  dashboardYangilandi(businessId);
  return NextResponse.json(sale, { status: 201 });
}, { module: "OMBOR" });
