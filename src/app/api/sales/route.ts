import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { createSaleSchema, createSaleKopSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { createSale, createSaleKop } from "@/lib/services/inventory";
import { listRecentSales } from "@/lib/queries/inventory";
import { dashboardYangilandi } from "@/lib/cache";
import { isModuleOnForTenant } from "@/lib/modules/guard";

export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);
  await requireOmborli(businessId);

  const sales = await listRecentSales(businessId);
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

  // Mijoz kartochkasi faqat MIJOZLAR moduli yoqiq bo'lsa yaratiladi
  // (/api/debts va /api/pos/chek bilan bir xil qoida).
  const mijozlarModuli = await isModuleOnForTenant(tenantCtx.tenantId, "MIJOZLAR");

  // SAVATLI SOTUV — `qatorlar` bo'lsa bir necha mahsulot BITTA atomik
  // amalda yoziladi. Eski, bir mahsulotli tana (`productId`) o'zgarishsiz
  // ishlayveradi: bot, POS va tashqi chaqiruvlar buzilmaydi.
  if (Array.isArray((body as { qatorlar?: unknown }).qatorlar)) {
    const kop = createSaleKopSchema.safeParse(body);
    if (!kop.success) {
      return NextResponse.json(
        { error: kop.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    const sotuvlar = await createSaleKop(
      {
        businessId,
        tolovTuri: kop.data.tolovTuri,
        contactId: kop.data.contactId,
        mijozNomi: kop.data.mijozNomi,
        mijozTel: kop.data.mijozTel,
        mijozSaqla: mijozlarModuli,
        accountId: kop.data.accountId,
        sana: kop.data.sana,
        userId: user.userId,
      },
      kop.data.qatorlar
    );
    dashboardYangilandi(businessId);
    return NextResponse.json({ sotuvlar }, { status: 201 });
  }

  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

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
