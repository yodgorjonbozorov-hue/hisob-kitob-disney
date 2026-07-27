import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { createTransactionSchema } from "@/lib/validation/transaction";
import { listTransactions } from "@/lib/queries/transactions";
import { createTransaction } from "@/lib/services/transactionService";
import { resolveActiveBusinessId } from "@/lib/business";
import { logAudit, getClientIp } from "@/lib/services/audit";

export const GET = withTenant(async (request, _ctx, { session: user }) => {

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });

  const { searchParams } = new URL(request.url);
  const result = await listTransactions({
    businessId,
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

export const POST = withTenant(async (request, _ctx, { session: user }) => {

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }


  const transaction = await createTransaction(user.userId, businessId, parsed.data);

  await logAudit({
    businessId, userId: user.userId, userIsm: user.ism,
    action: "create", entity: "transaction", entityId: transaction.id,
    after: { turi: parsed.data.turi, summa: parsed.data.summa, categoryId: parsed.data.categoryId },
    ip: getClientIp(request),
  });

  return NextResponse.json(transaction, { status: 201 });
});
