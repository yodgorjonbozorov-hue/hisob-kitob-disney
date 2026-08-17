import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerOrAdmin, ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateTransactionSchema, ozgarmasBuzilishi } from "@/lib/validation/transaction";
import { dateOnlyStringToUTCDate } from "@/lib/date";
import { resolveActiveBusinessId } from "@/lib/business";
import { dashboardYangilandi } from "@/lib/cache";
import { kunlikSinxron } from "@/lib/services/kunlik";
import { assertYozuvOzgarishi } from "@/lib/services/davrQulfi";

/**
 * Yozuvning MOLIYAVIY BO'LMAGAN qismini tahrirlaydi (izoh, filial, kategoriya).
 *
 * Summa, sana, turi, to'lov turi va kassa — o'zgarmas (audit: Critical #3).
 * Ularni tuzatish uchun `POST /api/transactions/[id]/storno`: yozuv sabab
 * bilan bekor qilinadi va o'rniga tuzatilgani yoziladi.
 */
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

  // MOLIYAVIY MAYDONLAR O'ZGARMAS. Yozuv tarixi jimgina qayta yozilmasin —
  // tuzatish faqat storno orqali, ya'ni iz qoldirib bajariladi.
  const buzilgan = ozgarmasBuzilishi(data, existing, dateOnlyStringToUTCDate);
  if (buzilgan.length > 0) {
    return NextResponse.json(
      {
        error:
          `Moliyaviy maydonni tahrirlab bo'lmaydi (${buzilgan.join(", ")}). ` +
          "Yozuvni sabab bilan bekor qilib, tuzatilganini kiriting.",
        // Mijoz kodi shu belgiga qarab storno oynasini ochadi.
        storno: true,
        maydonlar: buzilgan,
      },
      { status: 400 }
    );
  }

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

  const updated = await prisma.transaction.update({
    where: { id: params.id },
    data: {
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
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

  // `?permanent=true` OLIB TASHLANDI (audit: Critical #3): moliyaviy yozuvni
  // bazadan butunlay yo'q qilish audit izini ham, zaxiradan tiklash imkonini
  // ham yo'qotardi. Jimgina yumshoq o'chirishga o'tmaymiz — chaqiruvchi nima
  // bo'lganini bilishi kerak.
  if (new URL(request.url).searchParams.get("permanent") === "true") {
    return NextResponse.json(
      {
        error:
          "Moliyaviy yozuvni butunlay o'chirib bo'lmaydi. Yozuv savatda qoladi va " +
          "kerak bo'lsa tiklanadi; tuzatish uchun storno ishlating.",
      },
      { status: 400 }
    );
  }

  // Yopilgan davr qulfi: tasdiqlangan kun yoki yopilgan smenadagi yozuv
  // o'chirilmaydi (audit: Critical #4).
  await assertYozuvOzgarishi(businessId!, existing, "o'chirish");

  // Soft delete — belgilanadi (undo/savat uchun). Kunlikdagi ulangan tushum ham chiqadi.
  await prisma.transaction.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  await kunlikSinxron({ ...existing, deletedAt: new Date() }, null);
  dashboardYangilandi(existing.businessId);
  return NextResponse.json({ ok: true });
});
