import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { zakazgaTolovQoshish, zakazTolovHisobi } from "@/lib/crm/tolovQoshish";
import { zakazTolovSchema } from "@/lib/validation/crm";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * ZAKAZ TO'LOVLARI — QO'SHISH VA O'QISH.
 *
 * POST — zakazga BITTA yangi to'lov qo'shadi. Oldingi to'lovlar
 * TEGILMAYDI: bu qo'shimcha (append) amal, almashtirish emas. Pul o'sha
 * zahoti kirimga tushadi (naqd — naqd kassaga, click/terminal —
 * karta/hisob kassasiga), zakaz holati esa O'ZGARMAYDI: qisman to'langan
 * zakaz "Jarayonda" bo'lib qoladi va qolgan summa QARZGA yozilmaydi.
 *
 * Dublikat va poyga himoyasi bu route'da EMAS — `lib/crm/tolovQoshish.ts`
 * ichida, baza cheklovi va `tolangan` CAS sharti bilan birga.
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = zakazTolovSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    await zakazgaTolovQoshish({
      businessId,
      dealId: params.id,
      userId: user.userId,
      kanal: parsed.data.kanal,
      summa: parsed.data.summa,
      sana: parsed.data.sana,
      accountId: parsed.data.accountId,
    });

    // HAQIQIY kirim yozildi: "Jami kirim", kassa qoldig'i va "Bugungi holat"
    // darhol yangilanishi shart.
    dashboardYangilandi(businessId);
    const hisob = await zakazTolovHisobi(businessId, params.id);
    return NextResponse.json(hisob, { status: 201 });
  },
  { module: "CRM" }
);

/** Zakazning to'lovlari va hisobi (jami / to'langan / qoldiq). */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    return NextResponse.json(await zakazTolovHisobi(businessId, params.id));
  },
  { module: "CRM" }
);
