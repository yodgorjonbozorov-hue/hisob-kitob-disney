import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getKassaHolat, listKutilayotganTopshiriqlar } from "@/lib/queries/kassirKassa";

/**
 * KASSA TOPSHIRISH API — DEPRECATED (faqat o'qish).
 *
 * Bu eski tizim ledgerga ataylab tegmasdi va "kassirda qancha pul bor"
 * savoliga Account ledgeridan boshqa javob berardi. Ikkita moliyaviy haqiqat
 * manbai bo'lmasligi uchun YOZISH yopildi: yangi topshiriq
 * `/api/kassa-transfer` orqali (turi: "smena") yaratiladi.
 *
 * O'qish qoldirildi — mavjud tarix va qoldiqlarni ko'rish uchun. Tarixning
 * o'zi `AccountTransfer` ga `holat = "arxiv"` bilan ko'chirilgan
 * (scripts/kassa-handover-migratsiya.ts), shuning uchun jadval endi faqat
 * zaxira nusxa vazifasini bajaradi va hech qachon o'chirilmaydi.
 */

const DEPRECATED = {
  error:
    "Kassa topshirishning eski usuli o'chirildi. Endi \"Mening kassam\" → " +
    "\"Smenani topshirish\" ishlatiladi — u kassa qoldig'ini ham to'g'ri yangilaydi.",
};

/** GET — o'z kassa holati yoki (direktor uchun) kutilayotgan topshiriqlar. */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get("holat") === "kutilmoqda") {
    requireManager(user.rol);
    return NextResponse.json(await listKutilayotganTopshiriqlar(businessId));
  }
  return NextResponse.json(await getKassaHolat(businessId, { id: user.userId, ism: user.ism }));
});

/** POST — o'chirilgan. 410 Gone: yo'l mavjud edi, endi ishlamaydi. */
export const POST = withTenant(async () => NextResponse.json(DEPRECATED, { status: 410 }));
