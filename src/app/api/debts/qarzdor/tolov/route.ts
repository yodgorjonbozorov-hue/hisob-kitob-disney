import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId } from "@/lib/business";
import { qarzdorTolovSchema } from "@/lib/validation/qarz";
import { qarzdorTolov } from "@/lib/services/qarz";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * MIJOZ BO'YICHA TO'LOV QABUL QILISH.
 *
 * `/api/debts/[id]/payment` bitta QARZ YOZUVIGA to'lov yozadi; bu esa
 * SHAXSGA: mijozning bir nechta ochiq qarzi bo'lsa to'lov eng eskisidan
 * boshlab taqsimlanadi (yoki `taqsimot` bo'yicha qo'lda). Har qarz uchun
 * alohida kirim yoziladi — kategoriya kesimi saqlanadi.
 *
 * Biznes egaligi `qarzdorTolov` ichidagi `runBusinessTx` da tekshiriladi,
 * qarzlar esa faqat AKTIV biznes bo'yicha o'qiladi.
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = qarzdorTolovSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  const natija = await qarzdorTolov({
    businessId,
    userId: user.userId,
    turi: parsed.data.turi,
    kalit: parsed.data.kalit,
    summa: parsed.data.summa,
    sana: parsed.data.sana,
    tolovTuri: parsed.data.tolovTuri,
    accountId: parsed.data.accountId,
    izoh: parsed.data.izoh,
    idempotencyKey: parsed.data.idempotencyKey,
    taqsimot: parsed.data.taqsimot,
  });

  dashboardYangilandi(businessId);
  return NextResponse.json(natija);
});
