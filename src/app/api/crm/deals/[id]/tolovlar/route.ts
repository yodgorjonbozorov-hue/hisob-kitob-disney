import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { zakazgaTolovQoshish } from "@/lib/crm/tolovQoshish";
import { zakazTolovHisobi } from "@/lib/crm/tolovOqish";
import { zakazTolovSchema } from "@/lib/validation/crm";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * ZAKAZ TO'LOVLARI — RO'YXAT VA QO'SHISH.
 *
 * `PATCH /api/crm/deals/[id]` dagi `tolovlar` maydoni qatorlarni TO'LIQ
 * ALMASHTIRADI (forma yo'li). Bu route esa QO'SHADI: bir zakazga zalog,
 * keyin ikkinchi to'lov, keyin uchinchisi — oldingilari tegilmaydi.
 * Aynan shu farq "yangi to'lov oldingisini yuvib yuboradi" xatosini yopadi.
 *
 * Har to'lov o'z KIRIM tranzaksiyasini darhol oladi, shuning uchun bu
 * HAQIQIY pul harakati: dashboard keshi shu yerda bekor qilinadi.
 */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    return NextResponse.json(await zakazTolovHisobi(businessId, params.id));
  },
  { module: "CRM" }
);

export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = zakazTolovSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    // Dublikat to'lov va dublikat kirimga qarshi himoya route'da EMAS —
    // xizmat qatlamida, baza sharti bilan birga (`lib/crm/tolovQoshish.ts`).
    await zakazgaTolovQoshish({
      businessId,
      dealId: params.id,
      userId: user.userId,
      kanal: parsed.data.kanal,
      summa: parsed.data.summa,
      sana: parsed.data.sana,
      accountId: parsed.data.accountId,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json(await zakazTolovHisobi(businessId, params.id), { status: 201 });
  },
  { module: "CRM" }
);
