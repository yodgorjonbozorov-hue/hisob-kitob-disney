import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager, BadRequestError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listOmborKategoriyalar } from "@/lib/queries/ombor";
import { z } from "zod";

/**
 * MAHSULOT KATEGORIYALARI — mavjud `ProductCategory` modeli.
 *
 * Ombor ichida ikkinchi kategoriya tizimi QURILMAYDI: POS ekrani ham,
 * mahsulot importi ham AYNI shu jadvaldan o'qiydi. Bu yerda faqat
 * kartochka gridi tepasidagi chiplar uchun ro'yxat va yangi mahsulot
 * formasidan kategoriya qo'shish yo'li bor.
 *
 * `Category` (kirim/chiqim moliyaviy kategoriyasi) BOSHQA narsa —
 * ataylab aralashtirilmaydi.
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    return NextResponse.json(await listOmborKategoriyalar(businessId));
  },
  { module: "OMBOR" }
);

const yangiKategoriyaSchema = z.object({
  nomi: z.string().trim().min(1, "Kategoriya nomini kiriting").max(100),
});

export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = yangiKategoriyaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    // Takror yaratmaslik: o'chirilgan bir xil nomli kategoriya bo'lsa u
    // tiklanadi — aks holda `@@unique([businessId, nomi])` ga urilardi.
    const mavjud = await prisma.productCategory.findFirst({
      where: { businessId, nomi: parsed.data.nomi },
    });
    if (mavjud) {
      if (mavjud.deletedAt || !mavjud.isActive) {
        return NextResponse.json(
          await prisma.productCategory.update({
            where: { id: mavjud.id },
            data: { deletedAt: null, isActive: true },
          })
        );
      }
      throw new BadRequestError("Bu nomdagi kategoriya allaqachon bor");
    }

    return NextResponse.json(
      await prisma.productCategory.create({ data: { businessId, nomi: parsed.data.nomi } }),
      { status: 201 }
    );
  },
  { module: "OMBOR" }
);
