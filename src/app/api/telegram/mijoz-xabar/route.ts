import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { qaytaYuborishSchema } from "@/lib/validation/mijozTelegram";
import { xabarnomaniQaytaYubor } from "@/lib/services/mijozXabarnoma";

/**
 * "QAYTA YUBORISH" — buyurtma xabarini mijozga qayta jo'natish (spec 14/15).
 *
 * FAQAT DIREKTOR/ADMIN: mijozga ketadigan xabar — biznes hujjati. Kassir
 * uni o'z ixtiyori bilan qayta yuborsa, mijoz bir xaridni ikki marta
 * olgandek tuyulishi mumkin edi.
 *
 * Dublikatdan himoya xizmat qatlamida va BAZADA: allaqachon muvaffaqiyatli
 * ketgan xabar ikkinchi marta yuborilmaydi — o'rniga o'zgarish xabari
 * (SALE_UPDATED) yangi versiya bilan ketadi.
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = qaytaYuborishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await xabarnomaniQaytaYubor({
      businessId,
      chekId: parsed.data.chekId ?? null,
      saleId: parsed.data.saleId ?? null,
    });
    return NextResponse.json(natija);
  },
  { module: "MIJOZLAR" }
);
