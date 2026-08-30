import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { createTransactionSchema } from "@/lib/validation/transaction";
import { listTransactions } from "@/lib/queries/transactions";
import { isTolovBolimi, isTolovGuruhi, type TolovBolimi, type TolovGuruhi } from "@/lib/tolovBolimi";
import { chiqimYubor } from "@/lib/services/approval";
import { getEnabledModules } from "@/lib/modules/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { dashboardYangilandi } from "@/lib/cache";
import { hasPermission } from "@/lib/permissions/tekshir";
import { sotuvchiniHalQil } from "@/lib/services/sotuvchi";

export const GET = withTenant(async (request, _ctx, { session: user }) => {

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 20 });

  const { searchParams } = new URL(request.url);
  const result = await listTransactions({
    businessId,
    // Xodim faqat o'zi kiritgan yozuvlarni ko'radi, direktor — barchasini.
    userId: transactionScopeUserId(user),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    turi: searchParams.get("turi"),
    categoryId: searchParams.get("categoryId"),
    q: searchParams.get("q"),
    // Kategoriya tafsiloti shu bayroq bilan keladi: ro'yxat yig'indisi bosh
    // sahifadagi kategoriya summasi bilan bir xil bo'lishi uchun qarzga
    // yozilgan yozuvlar chiqarib tashlanadi (lib/qarzFiltr.ts).
    realPul: searchParams.get("realPul") === "1",
    kunlikJami: searchParams.get("kunlik") === "1",
    // "Jami kirim/chiqim" oynasidagi to'lov bo'limi (naqd/click/plastik/bank).
    tolovBolimi: isTolovBolimi(searchParams.get("tolovBolimi"))
      ? (searchParams.get("tolovBolimi") as TolovBolimi)
      : null,
    // Kirim/Chiqim sahifasidagi "To'lov" filtri (naqd/click/karta/qarz).
    tolov: isTolovGuruhi(searchParams.get("tolov"))
      ? (searchParams.get("tolov") as TolovGuruhi)
      : null,
    // "Kim kiritdi" filtri. Xodim uchun so'rovda kelgan qiymat baribir
    // e'tiborga olinmaydi — ko'rinuvchanlik chegarasi ustun (queries/transactions.ts).
    xodimId: searchParams.get("xodimId"),
    minSumma: searchParams.get("minSumma") ? parseInt(searchParams.get("minSumma")!, 10) : null,
    maxSumma: searchParams.get("maxSumma") ? parseInt(searchParams.get("maxSumma")!, 10) : null,
    page: parseInt(searchParams.get("page") ?? "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") ?? "20", 10),
  });

  // DAVR YAKUNI (jamiKirim / jamiChiqim / sof) — nozik ko'rsatkich.
  // UI uni faqat `hisobot.korish` huquqi bilan ko'rsatadi; API ham AYNI
  // qoidaga bo'ysunadi, aks holda tugmani yashirish himoya bo'lib qolardi.
  // Ro'yxat, sahifalash va kunlik jamlar hammaga avvalgidek qaytadi —
  // xodimning kundalik ishi to'xtamaydi.
  if (!(await hasPermission(user.userId, "hisobot.korish"))) {
    const { totals: _yashirin, ...qolgani } = result;
    return NextResponse.json(qolgani);
  }

  return NextResponse.json(result);
});

export const POST = withTenant(async (request, _ctx, tenantCtx) => {
  const user = tenantCtx.session;

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // SOTUVCHI/XODIM: kirimda har doim to'ldiriladi (berilmasa — yozuvchi o'zi);
  // boshqa xodimni tanlash faqat boshqaruvchiga, xodim shu biznesniki bo'lishi
  // shart (lib/services/sotuvchi.ts).
  parsed.data.sotuvchiId = await sotuvchiniHalQil(
    { userId: user.userId, rol: user.rol },
    businessId,
    parsed.data
  );

  // Chiqim tasdiqlash qoidasidan oshsa — yozuv emas, so'rov yaratiladi.
  const modullar = parsed.data.turi === "chiqim" ? await getEnabledModules(tenantCtx) : null;
  const natija = await chiqimYubor({
    modulYoqilgan: modullar?.has("TASDIQLASH") ?? false,
    businessId,
    user: { id: user.userId, rol: user.rol, ism: user.ism ?? "Xodim" },
    data: parsed.data,
  });

  if (natija.tasdiqKerak) {
    // 202 — qabul qilindi, lekin hali yozilmadi.
    return NextResponse.json(
      {
        tasdiqKutilmoqda: true,
        request: natija.request,
        message: `Summa tasdiqlash chegarasidan (${natija.chegara.toLocaleString("uz-UZ")} so'm) oshdi — rahbar tasdig'i kutilmoqda.`,
      },
      { status: 202 }
    );
  }

  dashboardYangilandi(businessId);
  return NextResponse.json(natija.transaction, { status: 201 });
});
