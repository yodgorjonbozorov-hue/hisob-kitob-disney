import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { getBoard } from "@/lib/crm/service";
import { doskaFiltrSchema } from "@/lib/validation/crm";
import { tolovHolati } from "@/lib/crm/pipeline";

/**
 * Doska ma'lumoti: bosqichlar + zakazlar (aktiv biznes bo'yicha).
 *
 * USTUNLAR bu yerda tanlanmaydi — har zakaz `holat` va `sana` bilan qaytadi,
 * ustunni `lib/crm/pipeline.ts` hisoblaydi (server va brauzer bir qoidada).
 *
 * `?sotuvchiId=` — CRM sotuvchi filtri: saralash BAZADA (biriktiruv jadvali
 * indeksi bo'yicha). Zakaz sotuvchilari `sotuvchilar` xaritasida qaytadi.
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ stages: [], deals: [], sotuvchilar: {} });

    const q = new URL(request.url).searchParams;
    const parsed = doskaFiltrSchema.safeParse({
      from: q.get("from"),
      to: q.get("to"),
      masulId: q.get("masulId"),
      categoryId: q.get("categoryId"),
      sotuvchiId: q.get("sotuvchiId"),
      tolov: q.get("tolov"),
      yoqotilgan: q.get("yoqotilgan") === "1",
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato filtr" }, { status: 400 });
    }

    const board = await getBoard(businessId, parsed.data);
    // TO'LOV HOLATI bazada ustun emas (u `summa` va `tolangan` dan
    // hisoblanadi), shuning uchun filtri o'qishdan keyin qo'llanadi.
    const deals = parsed.data.tolov
      ? board.deals.filter((d) => tolovHolati(d.summa, d.tolangan) === parsed.data.tolov)
      : board.deals;
    // Map JSON'ga tushmaydi — oddiy obyektga aylantiriladi.
    return NextResponse.json({ stages: board.stages, deals, sotuvchilar: Object.fromEntries(board.sotuvchilar) });
  },
  { module: "CRM" }
);
