import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";
import { createTransactionSchema } from "@/lib/validation/transaction";
import { listTransactions } from "@/lib/queries/transactions";
import { createTransaction } from "@/lib/services/transactionService";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(request.url);
    const result = await listTransactions({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      turi: searchParams.get("turi"),
      categoryId: searchParams.get("categoryId"),
      q: searchParams.get("q"),
      page: parseInt(searchParams.get("page") ?? "1", 10),
      pageSize: parseInt(searchParams.get("pageSize") ?? "20", 10),
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const transaction = await createTransaction(user.userId, parsed.data);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
