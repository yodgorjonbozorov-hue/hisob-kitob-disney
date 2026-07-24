import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listAllTransactions } from "@/lib/queries/transactions";
import { buildTransactionsWorkbook } from "@/lib/excel/transactionsWorkbook";

/** Filtrlangan tranzaksiyalarni Excel (.xlsx) qilib yuklab beradi. */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const items = await listAllTransactions({
      businessId,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      turi: user.rol === "sotuvchi" ? "kirim" : searchParams.get("turi"),
      categoryId: searchParams.get("categoryId"),
      q: searchParams.get("q"),
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
  } catch (error) {
    return handleApiError(error);
  }
}
