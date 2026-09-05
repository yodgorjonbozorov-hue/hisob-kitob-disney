import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager, BadRequestError } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { listOmborMahsulotlar } from "@/lib/queries/ombor";
import { omborMahsulotSchema, omborRoyxatSchema } from "@/lib/validation/taminot";
import { havolaniTekshir } from "@/lib/storage/driver";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * OMBOR MAHSULOTLARI — SERVER TOMONDA qidiriladi va sahifalanadi.
 *
 * Eski `/api/products` butun katalogni qaytarardi; 1000+ tovarli do'konda
 * bu har ochilishda megabaytlarcha JSON edi. Bu yerda faqat ko'rinadigan
 * sahifa qaytadi, qidiruv esa bazada bajariladi.
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) {
      return NextResponse.json({ mahsulotlar: [], jami: 0, sahifa: 1, limit: 24, yanaBor: false });
    }

    const sp = new URL(request.url).searchParams;
    const parsed = omborRoyxatSchema.safeParse({
      q: sp.get("q"),
      categoryId: sp.get("categoryId"),
      holat: sp.get("holat") ?? "barchasi",
      sahifa: Number(sp.get("sahifa") ?? 1),
      limit: Number(sp.get("limit") ?? 24),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato so'rov" },
        { status: 400 }
      );
    }
    return NextResponse.json(await listOmborMahsulotlar(businessId, parsed.data));
  },
  { module: "OMBOR" }
);

/**
 * YANGI MAHSULOT — minimal forma ("Omborga ta'minot" oqimi ichidan ham chaqiriladi).
 *
 * TAKROR YARATMASLIK: bir xil nomdagi mahsulot allaqachon bo'lsa yangisi
 * yaratilmaydi. Aks holda "Atirgul 50sm" har ta'minotda qaytadan qo'shilib,
 * qoldiq bir nechta kartochkaga bo'linib ketardi.
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireOmborli(businessId);

    const parsed = omborMahsulotSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const mavjud = await prisma.product.findFirst({
      where: { businessId, nomi: d.nomi },
      select: { id: true, nomi: true },
    });
    if (mavjud) {
      throw new BadRequestError(
        `"${mavjud.nomi}" allaqachon bor — ro'yxatdan tanlang (yangi nusxa yaratilmadi)`
      );
    }

    // Kategoriya shu biznesga tegishli ekani tekshiriladi (begona kategoriya
    // biriktirilsa mahsulot boshqa biznesning chipida ko'rinib qolardi).
    if (d.categoryId) {
      const kat = await prisma.productCategory.findFirst({
        where: { id: d.categoryId, businessId, deletedAt: null },
        select: { id: true },
      });
      if (!kat) throw new BadRequestError("Kategoriya topilmadi");
    }

    const product = await prisma.product.create({
      data: {
        businessId,
        nomi: d.nomi,
        categoryId: d.categoryId ?? undefined,
        birlik: d.birlik,
        kelganNarx: d.kelganNarx ?? 0,
        sotuvNarx: d.sotuvNarx ?? 0,
        sku: d.sku?.trim() || undefined,
        minQoldiq: d.minQoldiq ?? 0,
        // Havola sxemasi tekshiriladi: `javascript:`/`data:` saqlangan rasm
        // manzili sifatida XSS yo'liga aylanardi (lib/storage/driver.ts).
        rasmUrl: d.rasmUrl ? havolaniTekshir(d.rasmUrl) : undefined,
      },
    });
    dashboardYangilandi(businessId);
    return NextResponse.json(product, { status: 201 });
  },
  { module: "OMBOR" }
);
