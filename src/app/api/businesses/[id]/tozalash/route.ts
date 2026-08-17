import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/tenant";
import { biznesTozala } from "@/lib/services/tozalash";
import { dashboardYangilandi } from "@/lib/cache";

const tozalashSchema = z.object({
  /** Foydalanuvchi qo'lda yozgan biznes nomi — tasodifiy bosishdan himoya. */
  tasdiqNomi: z.string().min(1, "Biznes nomini yozing"),
  /** Shaxsiy bo'lmagan (umumiy) kassalar ham o'chirilsinmi. */
  kassalarniOchir: z.boolean().optional(),
});

/**
 * BIZNESNI BOSHLANG'ICH HOLATGA QAYTARISH.
 *
 * Qaytarib bo'lmaydigan amal, shuning uchun uch qavat himoya:
 *   1. faqat OWNER (xizmat qatlamida tekshiriladi);
 *   2. so'rov tanasida biznes nomi AYNAN yozilishi shart;
 *   3. hammasi bitta tranzaksiyada — o'rtada uzilsa hech nima o'chmaydi.
 *
 * Zaxira: build zanjirining birinchi halqasi har deployda xom surat oladi
 * (scripts/deploy-zaxira.mjs), shuning uchun oxirgi zaxira har doim mavjud.
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const parsed = tozalashSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await biznesTozala(
      params.id,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      {
        tasdiqNomi: parsed.data.tasdiqNomi,
        kassalarniOchir: parsed.data.kassalarniOchir === true,
      }
    );
    dashboardYangilandi(params.id);
    return NextResponse.json(natija);
  }
);
