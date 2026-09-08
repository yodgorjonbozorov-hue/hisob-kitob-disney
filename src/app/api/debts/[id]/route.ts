import { forbidSeller, ForbiddenError } from "@/lib/auth/guard";
import { isDirektor } from "@/lib/auth/roles";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId } from "@/lib/business";
import { getQarzTafsilot } from "@/lib/queries/qarz";
import { requirePermission } from "@/lib/permissions/tekshir";
import { qarzTahrirSchema, qarzOchirSchema } from "@/lib/validation/qarz";
import { qarzTahrirla, qarzOchir } from "@/lib/services/qarzTuzatish";
import { dashboardYangilandi } from "@/lib/cache";

/** Qarz tafsiloti — to'lovlar tarixi bilan birga. */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    forbidSeller(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const qarz = await getQarzTafsilot(businessId, params.id);
    if (!qarz) return NextResponse.json({ error: "Qarz topilmadi" }, { status: 404 });
    return NextResponse.json(qarz);
  }
);

/**
 * QARZNI TAHRIRLASH — FAQAT DIREKTOR (6-talab).
 *
 * DIREKTOR = KOMPANIYA EGASI (`OWNER`). ADMINISTRATOR (`ADMIN`) bu amalni
 * BAJARA OLMAYDI: qarz summasini o'zgartirish mijoz bilan hisob-kitobni
 * qayta yozish demakdir va javobgarlik kompaniya egasida qoladi.
 *
 * Ikki qavat himoya, ikkalasi ham SERVERDA:
 *   1. `isDirektor` — rol darajasi (faqat OWNER). Administrator, kassir yoki
 *      sotuvchi API'ni to'g'ridan-to'g'ri chaqirsa ham 403 oladi;
 *   2. `qarz.tahrir` granular huquqi — u ADMIN ning standart to'plamida ham
 *      YO'Q (`FAQAT_DIREKTOR`, lib/permissions/katalog.ts).
 *
 * Interfeysdagi tugmani yashirish HIMOYA EMAS — shuning uchun tekshiruv
 * aynan shu yerda turadi.
 */
function direktorTekshir(rol: string): void {
  if (!isDirektor(rol)) {
    throw new ForbiddenError("Qarzni tahrirlash va o'chirish faqat direktorga ruxsat etilgan");
  }
}
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    direktorTekshir(user.rol);
    await requirePermission(user.userId, "qarz.tahrir");

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = qarzTahrirSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const qarz = await qarzTahrirla({
      businessId,
      debtId: params.id,
      userId: user.userId,
      ...parsed.data,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json(qarz);
  }
);

/** QARZNI O'CHIRISH — FAQAT DIREKTOR. Yumshoq o'chirish, audit bilan. */
export const DELETE = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    direktorTekshir(user.rol);
    await requirePermission(user.userId, "qarz.tahrir");

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = qarzOchirSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "O'chirish sababini yozing" },
        { status: 400 }
      );
    }

    const oldin = await qarzOchir({
      businessId,
      debtId: params.id,
      userId: user.userId,
      sabab: parsed.data.sabab,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json({ ok: true, ochirildi: oldin });
  }
);
