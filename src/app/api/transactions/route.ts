import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { createTransactionSchema } from "@/lib/validation/transaction";
import { listTransactions } from "@/lib/queries/transactions";
import { chiqimYubor } from "@/lib/services/approval";
import { getEnabledModules } from "@/lib/modules/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { dashboardYangilandi } from "@/lib/cache";

export const GET = withTenant(async (request, _ctx, { session: user }) => {

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });

  const { searchParams } = new URL(request.url);
  const result = await listTransactions({
    businessId,
    // Xodim faqat o'zi kiritgan yozuvlarni ko'radi, direktor — barchasini.
    userId: transactionScopeUserId(user),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    turi: searchParams.get("turi"),
    categoryId: searchParams.get("categoryId"),
    q: searchParams.get("q"),
    minSumma: searchParams.get("minSumma") ? parseInt(searchParams.get("minSumma")!, 10) : null,
    maxSumma: searchParams.get("maxSumma") ? parseInt(searchParams.get("maxSumma")!, 10) : null,
    page: parseInt(searchParams.get("page") ?? "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") ?? "20", 10),
  });

  return NextResponse.json(result);
});

export const POST = withTenant(async (request, _ctx, tenantCtx) => {
  const user = tenantCtx.session;

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }


  // Chiqim tasdiqlash qoidasidan oshsa — yozuv emas, so'rov yaratiladi.
  const modullar = parsed.data.turi === "chiqim" ? await getEnabledModules(tenantCtx) : null;
  const natija = await chiqimYubor({
    modulYoqilgan: modullar?.has("TASDIQLASH") ?? false,
    businessId,
    user: { id: user.userId, rol: user.rol, ism: user.ism ?? "Xodim" },
    data: parsed.data,
  });

  if (natija.tasdiqKerak) {
    // 202 — qabul qilindi, lekin hali yozilmadi.
    return NextResponse.json(
      {
        tasdiqKutilmoqda: true,
        request: natija.request,
        message: `Summa tasdiqlash chegarasidan (${natija.chegara.toLocaleString("uz-UZ")} so'm) oshdi — rahbar tasdig'i kutilmoqda.`,
      },
      { status: 202 }
    );
  }

  dashboardYangilandi(businessId);
  return NextResponse.json(natija.transaction, { status: 201 });
});
