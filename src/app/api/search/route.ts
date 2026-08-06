import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { qidiruvRejimi } from "@/lib/db/dialect";
import { isManager } from "@/lib/auth/roles";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { rateLimit } from "@/lib/rateLimit";

/** Global qidiruv — aktiv biznes bo'yicha tranzaksiya/qarzdor/mahsulot/kategoriya. */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  // Qidiruv indekssiz `contains` bo'yicha 4 jadvalni skanerlaydi — cheklanmagan
  // parallel so'rov DoS bo'lishi mumkin (S-8). Foydalanuvchi bo'yicha 20/daqiqa.
  const rl = await rateLimit(`search:${user.userId}`, 20, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Juda ko'p qidiruv. ${rl.retryAfter} soniyadan keyin qayta urining.` },
      { status: 429 }
    );
  }

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ transactions: [], debtors: [], products: [], categories: [] });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ transactions: [], debtors: [], products: [], categories: [] });
  }

  const business = await getActiveBusiness(user);
  // Sotuvchi faqat kirim/chiqim bilan ishlaydi — qarzdor/mahsulot qidiruvi unga yopiq.
  const omborli = (business?.omborli ?? false) && user.rol !== "SELLER";
  const scopeUserId = transactionScopeUserId(user);

  const [transactions, debtors, products, categories] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        businessId,
        deletedAt: null,
        // Xodimga qidiruvda ham faqat o'zi kiritgan yozuvlar chiqadi.
        ...(scopeUserId ? { userId: scopeUserId } : {}),
        OR: [
          { izoh: { contains: q, ...qidiruvRejimi() } },
          { category: { nomi: { contains: q, ...qidiruvRejimi() } } },
        ],
      },
      include: { category: { select: { nomi: true } } },
      orderBy: { sana: "desc" },
      take: 6,
    }),
    omborli
      ? prisma.debt.findMany({
          where: { businessId, mijozNomi: { contains: q, ...qidiruvRejimi() } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    omborli
      ? prisma.product.findMany({
          where: { businessId, nomi: { contains: q, ...qidiruvRejimi() } },
          select: { id: true, nomi: true },
          take: 5,
        })
      : Promise.resolve([]),
    isManager(user.rol)
      ? prisma.category.findMany({
          where: { businessId, nomi: { contains: q, ...qidiruvRejimi() } },
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
});
