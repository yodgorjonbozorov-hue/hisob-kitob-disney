import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager, BadRequestError, ForbiddenError } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { mahsulotDetal } from "@/lib/queries/ombor";
import { omborMahsulotSchema } from "@/lib/validation/taminot";
import { havolaniTekshir } from "@/lib/storage/driver";
import { dashboardYangilandi } from "@/lib/cache";

/** Mahsulot tafsiloti + harakatlar tarixi (qoldiq nega o'zgargani). */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const detal = await mahsulotDetal(businessId, params.id);
    if (!detal) return NextResponse.json({ error: "Mahsulot topilmadi" }, { status: 404 });
    return NextResponse.json(detal);
  },
  { module: "OMBOR" }
);

/**
 * Mahsulotni tahrirlash (nomi, narx, rasm, kategoriya, minimal qoldiq).
 *
 * QOLDIQ BU YERDAN O'ZGARMAYDI — u faqat ta'minot, sotuv yoki
 * inventarizatsiya orqali o'zgaradi. Aks holda kim, qachon va NEGA
 * o'zgartirgani hech qayerda qolmasdi (`StockAdjustment` ning butun sababi).
 */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const mavjud = await prisma.product.findFirst({
      where: { id: params.id, businessId },
      select: { id: true },
    });
    if (!mavjud) throw new ForbiddenError("Mahsulot topilmadi");

    const parsed = omborMahsulotSchema.partial().safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    if (d.categoryId) {
      const kat = await prisma.productCategory.findFirst({
        where: { id: d.categoryId, businessId, deletedAt: null },
        select: { id: true },
      });
      if (!kat) throw new BadRequestError("Kategoriya topilmadi");
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(d.nomi !== undefined ? { nomi: d.nomi } : {}),
        ...(d.categoryId !== undefined ? { categoryId: d.categoryId } : {}),
        ...(d.birlik !== undefined ? { birlik: d.birlik } : {}),
        ...(d.kelganNarx !== undefined ? { kelganNarx: d.kelganNarx } : {}),
        ...(d.sotuvNarx !== undefined ? { sotuvNarx: d.sotuvNarx } : {}),
        ...(d.sku !== undefined ? { sku: d.sku?.trim() || null } : {}),
        ...(d.minQoldiq !== undefined ? { minQoldiq: d.minQoldiq } : {}),
        // `null` — rasmni olib tashlash; matn — tekshirilgan havola.
        ...(d.rasmUrl !== undefined
          ? { rasmUrl: d.rasmUrl ? havolaniTekshir(d.rasmUrl) : null }
          : {}),
      },
    });
    dashboardYangilandi(businessId);
    return NextResponse.json(product);
  },
  { module: "OMBOR" }
);
