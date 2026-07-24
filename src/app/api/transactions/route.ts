import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { createTransactionSchema } from "@/lib/validation/transaction";
import { listTransactions } from "@/lib/queries/transactions";
import { createTransaction } from "@/lib/services/transactionService";
import { resolveActiveBusinessId } from "@/lib/business";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });

    const { searchParams } = new URL(request.url);
    // Sotuvchi faqat kirim (sotuv) yozuvlarini ko'radi — chiqim/foyda ko'rinmaydi.
    const turi = user.rol === "sotuvchi" ? "kirim" : searchParams.get("turi");
    const result = await listTransactions({
      businessId,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      turi,
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

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    // Sotuvchi faqat kirim qo'sha oladi (chiqim/xarajat kirita olmaydi).
    if (user.rol === "sotuvchi" && parsed.data.turi !== "kirim") {
      throw new ForbiddenError("Sotuvchi faqat kirim qo'sha oladi");
    }

    const transaction = await createTransaction(user.userId, businessId, parsed.data);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
