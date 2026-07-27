import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";

/** Global qidiruv — aktiv biznes bo'yicha tranzaksiya/qarzdor/mahsulot/kategoriya. */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ transactions: [], debtors: [], products: [], categories: [] });

    const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ transactions: [], debtors: [], products: [], categories: [] });
    }

    const business = await getActiveBusiness(user);
    const omborli = business?.omborli ?? false;

    const [transactions, debtors, products, categories] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          businessId,
          deletedAt: null,
          OR: [{ izoh: { contains: q } }, { category: { nomi: { contains: q } } }],
        },
        include: { category: { select: { nomi: true } } },
        orderBy: { sana: "desc" },
        take: 6,
      }),
      omborli
        ? prisma.debt.findMany({
            where: { businessId, mijozNomi: { contains: q } },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
      omborli
        ? prisma.product.findMany({
            where: { businessId, nomi: { contains: q } },
            select: { id: true, nomi: true },
            take: 5,
          })
        : Promise.resolve([]),
      isManager(user.rol)
        ? prisma.category.findMany({
            where: { businessId, nomi: { contains: q } },
            select: { id: true, nomi: true, turi: true },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        summa: t.summa,
        turi: t.turi,
        categoryNomi: t.category.nomi,
        izoh: t.izoh,
        sana: t.sana.toISOString(),
      })),
      debtors: (debtors as { id: string; mijozNomi: string; jamiSumma: number; tolangan: number }[]).map((d) => ({
        id: d.id,
        mijozNomi: d.mijozNomi,
        qolgan: d.jamiSumma - d.tolangan,
      })),
      products: products as { id: string; nomi: string }[],
      categories: categories as { id: string; nomi: string; turi: string }[],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
