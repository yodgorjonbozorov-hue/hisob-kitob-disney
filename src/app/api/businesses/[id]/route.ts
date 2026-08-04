import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateBusinessSchema } from "@/lib/validation/business";

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);

  const body = await request.json();
  const parsed = updateBusinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Avto rejimi ombor tizimisiz ishlamaydi — birga yoqiladi.
  const omborli = parsed.data.turi === "avto" ? { omborli: true } : {};
  const business = await prisma.business.update({
    where: { id: params.id },
    data: { ...parsed.data, ...omborli },
  });

  return NextResponse.json(business);
});

/**
 * Biznesni butunlay o'chirish — faqat direktor va faqat BO'SH biznes (yozuv/mahsulot/
 * sotuv/qarz/biriktirilgan foydalanuvchi yo'q). Ma'lumot bor bo'lsa — rad etiladi
 * (data yo'qolmasin); direktor uni "nofaollashtirsin" yoki ma'lumotni ko'chirsin.
 */
export const DELETE = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);
  const id = params.id;

  const biz = await prisma.business.findUnique({ where: { id }, select: { id: true, nomi: true } });
  if (!biz) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const [txCount, prodCount, saleCount, debtCount, userCount] = await Promise.all([
    prisma.transaction.count({ where: { businessId: id } }),
    prisma.product.count({ where: { businessId: id } }),
    prisma.sale.count({ where: { businessId: id } }),
    prisma.debt.count({ where: { businessId: id } }),
    prisma.user.count({ where: { businessId: id } }),
  ]);

  if (txCount + prodCount + saleCount + debtCount + userCount > 0) {
    const parts: string[] = [];
    if (txCount) parts.push(`${txCount} yozuv`);
    if (prodCount) parts.push(`${prodCount} mahsulot`);
    if (saleCount) parts.push(`${saleCount} sotuv`);
    if (debtCount) parts.push(`${debtCount} qarz`);
    if (userCount) parts.push(`${userCount} foydalanuvchi`);
    return NextResponse.json(
      {
        error: `Bu bizneste ma'lumot bor (${parts.join(", ")}). O'chirib bo'lmaydi — avval ularni ko'chiring/o'chiring, yoki biznesni "Nofaollashtiring".`,
      },
      { status: 409 }
    );
  }

  // Bo'sh biznes — config yozuvlarini (kategoriya, budjet, takroriy) tozalab, biznesni o'chiramiz.
  try {
    await prisma.budget.deleteMany({ where: { businessId: id } });
    await prisma.recurringTransaction.deleteMany({ where: { businessId: id } });
    await prisma.category.deleteMany({ where: { businessId: id } });
    await prisma.business.delete({ where: { id } });
  } catch (e) {
    console.error("Business delete xatosi:", e);
    return NextResponse.json(
      {
        error:
          "Biznesni o'chirib bo'lmadi (u boshqa yozuvlarga bog'langan bo'lishi mumkin). Uni \"Nofaollashtiring\".",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
});
