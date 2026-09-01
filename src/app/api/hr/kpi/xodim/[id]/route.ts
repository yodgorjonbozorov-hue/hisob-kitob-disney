import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString } from "@/lib/date";
import { hisoblaXodim } from "@/lib/kpi/oylik";
import { ballTarixi } from "@/lib/kpi/ball";
import { xodimKirishTekshir } from "@/lib/kpi/ruxsat";
import { listPresetlar } from "@/lib/kpi/vazifa";
import { sotuvYozuvlari } from "@/lib/kpi/sotuv";
import { tuzatishlar } from "@/lib/kpi/payroll";
import { utcDateToDateOnlyString } from "@/lib/date";

/** BITTA XODIMNING OY TAFSILOTI — hisob, vazifalar, ball tarixi, sotuvlar. */
export const GET = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session }) => {
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    // IDOR: mijozdan kelgan id shu yerda tekshiriladi (o'zi yoki rahbar).
    await xodimKirishTekshir(session, businessId, params.id);

    const oyParam = new URL(request.url).searchParams.get("oy");
    const oy = /^\d{4}-\d{2}$/.test(oyParam ?? "") ? oyParam! : currentMonthString();

    const natija = await hisoblaXodim(businessId, params.id, oy);
    if (!natija) return NextResponse.json({ error: "Xodim topilmadi" }, { status: 404 });

    const [tarix, presetlar, sotuvlar, tuzatishRoyxati] = await Promise.all([
      ballTarixi(businessId, params.id, oy),
      listPresetlar(businessId),
      natija.hisob.userId
        ? sotuvYozuvlari(businessId, natija.hisob.userId, oy)
        : Promise.resolve([]),
      natija.hisob.payrollId
        ? tuzatishlar(businessId, natija.hisob.payrollId)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      oy,
      hisob: natija.hisob,
      sozlama: natija.sozlama,
      tarix,
      presetlar,
      tuzatishlar: tuzatishRoyxati,
      sotuvlar: sotuvlar.map((s) => ({ ...s, sana: utcDateToDateOnlyString(s.sana) })),
    });
  },
  { module: "HR" }
);
