import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { listDebts } from "@/lib/queries/inventory";
import { createDebtSchema } from "@/lib/validation/inventory";
import { createDebt } from "@/lib/services/inventory";

/** Qarzdorlik ro'yxati (ikki yo'nalish) — admin va kassir (o'z biznesi). */
export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);
  await requireOmborli(businessId);

  const debts = await listDebts(businessId);
  return NextResponse.json(debts);
}, { module: "OMBOR" });

/** Qo'lda qarzdorlik qo'shish — sotuvdan tashqari (masalan mashina qarzga olindi). */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  const body = await request.json();
  const parsed = createDebtSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const debt = await createDebt({
    businessId,
    turi: parsed.data.turi,
    mijozNomi: parsed.data.mijozNomi,
    mijozTel: parsed.data.mijozTel,
    jamiSumma: parsed.data.jamiSumma,
    tolangan: parsed.data.tolangan,
    productId: parsed.data.productId,
    muddat: parsed.data.muddat,
    izoh: parsed.data.izoh,
    userId: user.userId,
  });

  return NextResponse.json(debt, { status: 201 });
}, { module: "OMBOR" });
