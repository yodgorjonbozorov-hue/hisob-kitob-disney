import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { listTaminotlar } from "@/lib/queries/ombor";
import { taminotYarat } from "@/lib/services/taminot";
import { createTaminotSchema } from "@/lib/validation/taminot";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * TA'MINOT ("Omborga ta'minot") — Ombor modulining yozuv amali.
 *
 * NEGA `OMBOR` MODULIDA, `XARID` da emas: "omborga ta'minot" — omborning eng
 * asosiy hodisasi, uni alohida modul ortiga yashirish gul do'koni yoki
 * kichik magazin uchun ma'nosiz. Eski uch qadamli XARID oqimi (reja →
 * tasdiq → qabul) o'z modulida qoldi; ikkalasi ham bir xil hisob
 * qoidasidan (`qabulYozuvlariTx`) foydalanadi.
 *
 * RBAC: yozuv ham, o'qish ham faqat boshqaruvchi (OWNER/ADMIN) — ta'minot
 * pul qarori. Bu redesign hech kimga yangi huquq OCHMAYDI.
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ taminotlar: [], jami: 0, yanaBor: false });

    const sp = new URL(request.url).searchParams;
    const sahifa = Number(sp.get("sahifa") ?? 1);
    const limit = Number(sp.get("limit") ?? 20);
    return NextResponse.json(
      await listTaminotlar(businessId, {
        sahifa: Number.isFinite(sahifa) ? sahifa : 1,
        limit: Number.isFinite(limit) ? limit : 20,
        supplierId: sp.get("supplierId"),
      })
    );
  },
  { module: "OMBOR" }
);

export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireOmborli(businessId);

    const parsed = createTaminotSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await taminotYarat({ businessId, userId: user.userId, data: parsed.data });
    // Ombor qoldig'i va qiymati o'zgardi — bosh sahifadagi karta eskirmasin.
    dashboardYangilandi(businessId);
    // Takror yuborishda yangi yozuv yaratilmadi: 200 (201 emas) qaytadi,
    // lekin foydalanuvchi uchun amal baribir muvaffaqiyatli.
    return NextResponse.json(natija, { status: natija.takror ? 200 : 201 });
  },
  { module: "OMBOR" }
);
