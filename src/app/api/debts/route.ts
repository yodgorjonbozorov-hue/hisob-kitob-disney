import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { resolveActiveBusinessId } from "@/lib/business";
import { listQarzlar, getQarzDashboard } from "@/lib/queries/qarz";
import { createQarzSchema } from "@/lib/validation/qarz";
import { createQarz } from "@/lib/services/qarz";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * QARZDORLIK — admin va kassir (o'z biznesi).
 *
 * OMBOR moduli SHARTI OLIB TASHLANDI: qarz endi ombordan mustaqil moliyaviy
 * majburiyat. Ilgari ombori yo'q biznes "Kirim → Qarz" yozardi, lekin uni
 * ko'rsatadigan sahifasi yo'q edi — qarz shu bilan yo'qolib ketardi.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ items: [], dashboard: null });

  const { searchParams } = new URL(request.url);
  const [items, dashboard] = await Promise.all([
    listQarzlar(businessId, {
      turi: searchParams.get("turi"),
      status: searchParams.get("status"),
      q: searchParams.get("q"),
      muddatOtgan: searchParams.get("muddatOtgan") === "1",
    }),
    getQarzDashboard(businessId),
  ]);

  return NextResponse.json({ items, dashboard });
});

/**
 * Qarz yaratish — Yozuvlar sahifasidagi "Kirim → Qarz" ham, Qarzlar
 * sahifasidagi "Yangi qarzdorlik" ham shu yerga keladi.
 *
 * PUL HARAKATI YOZILMAYDI: kirim faqat to'lov qabul qilinganda, to'lov
 * sanasi bilan yoziladi.
 */
export const POST = withTenant(async (request, _ctx, tenantCtx) => {
  const user = tenantCtx.session;
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = createQarzSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Mijoz kartochkasi faqat MIJOZLAR moduli yoqiq bo'lsa yaratiladi —
  // o'chirilgan modul uchun ma'lumot to'planmasin.
  const mijozlarModuli = await isModuleOnForTenant(tenantCtx.tenantId, "MIJOZLAR");

  const qarz = await createQarz({
    businessId,
    userId: user.userId,
    turi: parsed.data.turi,
    contactId: parsed.data.contactId,
    mijozNomi: parsed.data.mijozNomi,
    mijozTel: parsed.data.mijozTel,
    mijozSaqla: mijozlarModuli && parsed.data.mijozSaqla !== false,
    jamiSumma: parsed.data.jamiSumma,
    sana: parsed.data.sana,
    categoryId: parsed.data.categoryId,
    masulId: parsed.data.masulId,
    productId: parsed.data.productId,
    muddat: parsed.data.muddat,
    izoh: parsed.data.izoh,
    tolangan: parsed.data.tolangan,
  });

  // Qarz balansga tushmaydi, lekin "Qarzga berilgan" ko'rsatkichi o'zgaradi.
  dashboardYangilandi(businessId);
  return NextResponse.json(qarz, { status: 201 });
});
