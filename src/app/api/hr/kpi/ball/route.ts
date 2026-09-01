import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { ballAyir } from "@/lib/kpi/ball";
import { ballHuquqi } from "@/lib/kpi/ruxsat";
import { ballAyirSchema } from "@/lib/validation/kpi";

/**
 * BALL AYIRISH.
 *
 * `kritik` bayrog'i MIJOZDAN olinmaydi. Preset tanlangan bo'lsa ball ham,
 * kritiklik ham SERVERDA presetdan o'qiladi — aks holda foydalanuvchi
 * so'rovni qo'lda yasab, oddiy jarimani "kritik" deb belgilab kunlik
 * limitdan chetlab o'tishi mumkin edi.
 */
export const POST = withTenant(
  async (request, _ctx, { session }) => {
    await ballHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = ballAyirSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    const d = parsed.data;

    let ball = d.ball;
    let kritik = false;
    let sabab = d.sabab;

    if (d.presetId) {
      const preset = await prisma.kpiPenaltyPreset.findFirst({
        where: { id: d.presetId, businessId, aktiv: true },
        select: { ball: true, kritik: true, sabab: true },
      });
      if (!preset) {
        return NextResponse.json({ error: "Jarima sababi topilmadi" }, { status: 400 });
      }
      ball = preset.ball;
      kritik = preset.kritik;
      sabab = preset.sabab;
    }

    const natija = await ballAyir({
      businessId,
      employeeId: d.employeeId,
      taskId: d.taskId,
      userId: session.userId,
      userIsm: session.ism ?? null,
      sana: d.sana,
      ball,
      sabab,
      izoh: d.izoh,
      kritik,
      presetId: d.presetId ?? null,
    });
    return NextResponse.json(natija, { status: 201 });
  },
  { module: "HR" }
);
