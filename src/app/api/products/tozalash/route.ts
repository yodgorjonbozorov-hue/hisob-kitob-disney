import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { listOmborKategoriyalar } from "@/lib/queries/ombor";
import { katalogTozalashSchema } from "@/lib/validation/inventory";
import { katalogniTozala, tozalashniKorish } from "@/lib/services/katalogTozalash";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * KATALOGNI TOZALASH — faqat direktor/admin.
 *
 * GET — kategoriyalar va sonlar (modal ro'yxati uchun).
 * POST `tekshirish: true` — nima o'chishini oldindan hisoblaydi (yozmaydi).
 * POST — tanlangan kategoriyalardan boshqa tovarlarni o'chiradi; tarixi
 * borlari nofaol bo'ladi (`katalogTozalash.ts` dagi sabablar).
 */
export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireOmborli(businessId);

    const [kategoriyalar, kategoriyasiz, jami] = await Promise.all([
      listOmborKategoriyalar(businessId),
      prisma.product.count({ where: { businessId, categoryId: null } }),
      prisma.product.count({ where: { businessId } }),
    ]);
    return NextResponse.json({ kategoriyalar, kategoriyasiz, jami });
  },
  { module: "OMBOR" }
);

export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireOmborli(businessId);

    const parsed = katalogTozalashSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    if (d.tekshirish) {
      const hisob = await tozalashniKorish({
        businessId,
        saqlanadiganKategoriyalar: d.saqlanadiganKategoriyalar,
        kategoriyasizSaqlansin: d.kategoriyasizSaqlansin,
      });
      return NextResponse.json(hisob);
    }

    const natija = await katalogniTozala({
      businessId,
      userId: user.userId,
      saqlanadiganKategoriyalar: d.saqlanadiganKategoriyalar,
      kategoriyasizSaqlansin: d.kategoriyasizSaqlansin,
    });
    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  },
  { module: "OMBOR" }
);
