import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { isManager } from "@/lib/auth/roles";
import { updateTransactionSchema } from "@/lib/validation/transaction";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { resolveActiveBusinessId } from "@/lib/business";
import { resolveAccountId } from "@/lib/services/accounts";
import { dashboardYangilandi } from "@/lib/cache";
import { kunlikSinxron } from "@/lib/services/kunlik";

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);

  const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Tranzaksiya topilmadi" }, { status: 404 });
  }
  // Faqat aktiv biznesning yozuvi tahrirlanadi (cross-business himoya).
  if (existing.businessId !== businessId) {
    throw new ForbiddenError("Bu yozuv boshqa biznesga tegishli");
  }
  if (existing.deletedAt) {
    throw new ForbiddenError("O'chirilgan yozuvni tahrirlab bo'lmaydi");
  }
  requireOwnerOrAdmin(user.rol, user.userId, existing.userId);

  const body = await request.json();
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const data = parsed.data;

  // Kategoriya o'zgartirilsa, u ham shu biznesga tegishli bo'lishi kerak.
  if (data.categoryId !== undefined) {
    const cat = await prisma.category.findUnique({
      where: { id: data.categoryId },
      select: { businessId: true },
    });
    if (!cat || cat.businessId !== existing.businessId) {
      throw new ForbiddenError("Kategoriya bu biznesga tegishli emas");
    }
  }

  // To'lov turi qoidasi yakuniy holatda tekshiriladi (turi va tolovTuri
  // birga yoki alohida o'zgarishi mumkin): qarz faqat kirim uchun.
  const yakuniyTuri = data.turi ?? existing.turi;
  const yakuniyTolov = data.tolovTuri !== undefined ? data.tolovTuri : existing.tolovTuri;
  if (yakuniyTolov === "qarz" && yakuniyTuri === "chiqim") {
    return NextResponse.json({ error: "Qarz to'lov turi faqat kirim uchun" }, { status: 400 });
  }

  // Kassa bog'lanishi to'lov turiga ergashadi: qarz — kassasiz; qarzdan
  // naqd/click'ka qaytsa — mos faol kassa qayta bog'lanadi.
  let accountYangilash: { accountId: string | null } | Record<string, never> = {};
  if (data.tolovTuri !== undefined) {
    if (yakuniyTolov === "qarz") {
      accountYangilash = { accountId: null };
    } else if (existing.accountId === null || data.accountId !== undefined) {
      accountYangilash = {
        accountId: await resolveAccountId(businessId!, data.accountId, yakuniyTolov),
      };
    }
  }

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      ...(data.turi !== undefined ? { turi: data.turi } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.summa !== undefined ? { summa: data.summa } : {}),
      ...(data.sana !== undefined ? { sana: dateOnlyStringToUTCDate(data.sana) } : {}),
      ...(data.tolovTuri !== undefined ? { tolovTuri: data.tolovTuri } : {}),
      ...accountYangilash,
      ...(data.izoh !== undefined ? { izoh: data.izoh } : {}),
      ...(data.filial !== undefined ? { filial: data.filial } : {}),
    },
    include: {
      category: true,
      user: { select: { id: true, ism: true } },
      account: { select: { id: true, nomi: true, turi: true } },
    },
  });

  // Kunlik hisobot bilan sinxron: sana bugungidan boshqasiga o'zgarsa kunlikdan
  // chiqadi, bugunga o'zgarsa tushadi, summa o'zgarsa qayta jamlanadi.
  await kunlikSinxron(updated, updated.user.ism);

  dashboardYangilandi(existing.businessId);
  return NextResponse.json(updated);
});

export const DELETE = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);

  const existing = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Tranzaksiya topilmadi" }, { status: 404 });
  }
  if (existing.businessId !== businessId) {
    throw new ForbiddenError("Bu yozuv boshqa biznesga tegishli");
  }
  requireOwnerOrAdmin(user.rol, user.userId, existing.userId);

  const permanent = new URL(request.url).searchParams.get("permanent") === "true";

  if (permanent) {
    // Butunlay o'chirish — faqat admin. Avval kunlikdagi ulangan tushum olib tashlanadi.
    if (!isManager(user.rol)) throw new ForbiddenError("Butunlay o'chirish faqat direktor uchun");
    await kunlikSinxron({ ...existing, deletedAt: new Date() }, null);
    await prisma.transaction.delete({ where: { id: params.id } });
    dashboardYangilandi(existing.businessId);
    return NextResponse.json({ ok: true, permanent: true });
  }

  // Soft delete — belgilanadi (undo/savat uchun). Kunlikdagi ulangan tushum ham chiqadi.
  await prisma.transaction.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await kunlikSinxron({ ...existing, deletedAt: new Date() }, null);
  dashboardYangilandi(existing.businessId);
  return NextResponse.json({ ok: true });
});
