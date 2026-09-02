import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { getKunlikReport } from "@/lib/queries/kunlik";
import { getKunlikRuxsat, kunlikBugun } from "@/lib/services/kunlik";
import { hasPermission } from "@/lib/permissions/tekshir";

/**
 * GET /api/kunlik/hisobot?sana=YYYY-MM-DD — bitta kunning hisoboti.
 * Xodim (kassir/sotuvchi) faqat BUGUNGI kunni ko'radi; boshqa kunlar —
 * direktor va boshqaruvchilar uchun.
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const bugun = kunlikBugun();
    const { searchParams } = new URL(request.url);
    const sana = searchParams.get("sana") || bugun;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) {
      return NextResponse.json({ error: "Sana noto'g'ri formatda" }, { status: 400 });
    }

    const ruxsat = await getKunlikRuxsat(businessId, {
      userId: user.userId,
      ism: user.ism,
      rol: user.rol,
    });
    if (sana !== bugun && !ruxsat.tarixniKoradi) {
      return NextResponse.json({ error: "Oldingi kunlarni ko'rish huquqi yo'q" }, { status: 403 });
    }

    // MOLIYAVIY KESIM (chiqim va sof natija) — faqat `hisobot.korish` huquqi
    // bilan. Kassirning O'Z tushumi (naqd/click/qarz va jami) qoladi: kassa
    // topshirig'i aynan shu raqam ustida yuritiladi, usiz kun yopilmaydi.
    const moliyaKorinadi = await hasPermission(user.userId, "hisobot.korish");
    const report = await getKunlikReport(businessId, sana, moliyaKorinadi);
    return NextResponse.json({ report, ruxsat, bugun });
  },
  { module: "KUNLIK" }
);
