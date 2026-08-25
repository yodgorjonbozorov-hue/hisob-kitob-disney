import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId } from "@/lib/business";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { listAllTransactions } from "@/lib/queries/transactions";
import { isTolovGuruhi, type TolovGuruhi } from "@/lib/tolovBolimi";
import { buildTransactionsWorkbook } from "@/lib/excel/transactionsWorkbook";

/** Filtrlangan tranzaksiyalarni Excel (.xlsx) qilib yuklab beradi. */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const items = await listAllTransactions({
    businessId,
    // Eksport ham ekrandagi bilan bir xil chegarada: xodim — faqat o'zi kiritganini.
    userId: transactionScopeUserId(user),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    turi: searchParams.get("turi"),
    categoryId: searchParams.get("categoryId"),
    q: searchParams.get("q"),
    // Eksport ekrandagi FILTR bilan bir xil to'plamni beradi — yangi
    // filtrlar ham (to'lov turi, kim kiritdi) shu yerga o'tkaziladi.
    tolov: isTolovGuruhi(searchParams.get("tolov"))
      ? (searchParams.get("tolov") as TolovGuruhi)
      : null,
    xodimId: searchParams.get("xodimId"),
    minSumma: searchParams.get("minSumma") ? parseInt(searchParams.get("minSumma")!, 10) : null,
    maxSumma: searchParams.get("maxSumma") ? parseInt(searchParams.get("maxSumma")!, 10) : null,
  });

  const buffer = await buildTransactionsWorkbook(items);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tranzaksiyalar.xlsx"`,
    },
  });
});
