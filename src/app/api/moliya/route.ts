import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { hasPermission, requirePermission } from "@/lib/permissions/tekshir";
import { listPulHarakatlari } from "@/lib/queries/moliya";
import { pulHarakatiSchema } from "@/lib/validation/moliya";
import { pulHarakatiYoz } from "@/lib/services/pulOqimi";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * MOLIYA — "Pul oldim / Pul berdim" oqimi.
 *
 * Huquqlar YANGI EMAS: ro'yxat `tranzaksiya.korish`, yozish esa
 * `tranzaksiya.yaratish` bilan ochiladi (lib/permissions/katalog.ts).
 * Ko'rinuvchanlik chegarasi ham o'sha: xodim faqat o'zi kiritgan
 * yozuvlarni ko'radi, direktor — barchasini (lib/auth/visibility.ts).
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  await requirePermission(user.userId, "tranzaksiya.korish");

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 20, totals: null });
  }

  const sp = new URL(request.url).searchParams;
  const turi = sp.get("turi");
  const natija = await listPulHarakatlari({
    businessId,
    userId: transactionScopeUserId(user),
    turi: turi === "kirim" || turi === "chiqim" ? turi : null,
    from: sp.get("from"),
    to: sp.get("to"),
    q: sp.get("q"),
    categoryId: sp.get("categoryId"),
    xodimId: sp.get("xodimId"),
    page: parseInt(sp.get("page") ?? "1", 10),
    pageSize: parseInt(sp.get("pageSize") ?? "30", 10),
  });

  // DAVR YAKUNI nozik ko'rsatkich — Kirim/Chiqim sahifasi bilan AYNI qoida:
  // huquqi bo'lmasa raqamlar umuman yuborilmaydi.
  if (!(await hasPermission(user.userId, "hisobot.korish"))) {
    return NextResponse.json({ ...natija, totals: null });
  }
  return NextResponse.json(natija);
});

export const POST = withTenant(async (request, _ctx, { session: user }) => {
  await requirePermission(user.userId, "tranzaksiya.yaratish");

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = pulHarakatiSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  const natija = await pulHarakatiYoz({
    businessId,
    userId: user.userId,
    ...parsed.data,
  });

  dashboardYangilandi(businessId);
  return NextResponse.json(natija, { status: natija.yangi ? 201 : 200 });
});
