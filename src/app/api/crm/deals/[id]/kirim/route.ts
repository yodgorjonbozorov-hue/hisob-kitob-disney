import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { kirimgaKochirish, buyurtmaKirimi } from "@/lib/crm/kirim";
import { kirimgaSchema } from "@/lib/validation/crm";

/**
 * BUYURTMANI KIRIMGA O'TKAZISH.
 *
 * Dublikatga qarshi himoya bu route'da EMAS — `lib/crm/kirim.ts` ichida,
 * baza cheklovi bilan birga. Route faqat kirish nuqtasi.
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    // Tanasi bo'sh bo'lishi mumkin (odatiy holat: kassa tanlanmaydi).
    const xom = await request.json().catch(() => ({}));
    const parsed = kirimgaSchema.safeParse(xom ?? {});
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const txn = await kirimgaKochirish({
      businessId,
      dealId: params.id,
      userId: user.userId,
      accountId: parsed.data.accountId,
      tolovTuri: parsed.data.tolovTuri,
    });
    return NextResponse.json({ transactionId: txn.id, summa: txn.summa }, { status: 201 });
  },
  { module: "CRM" }
);

/** Buyurtmaga bog'langan kirim yozuvi (havola/tekshirish uchun). */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ transaction: null });
    const txn = await buyurtmaKirimi(businessId, params.id);
    return NextResponse.json({ transaction: txn });
  },
  { module: "CRM" }
);
