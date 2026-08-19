import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { csvYasa } from "@/lib/csv";
import {
  listMahsulotEksport,
  eksportQatoriMassiv,
  EKSPORT_SARLAVHASI,
} from "@/lib/queries/mahsulotEksport";
import { buildMahsulotlarWorkbook } from "@/lib/excel/mahsulotlarWorkbook";

/**
 * KATALOG EKSPORTI (CSV yoki Excel).
 *
 * Tannarx va qoldiq — boshqaruvchi ma'lumoti, shuning uchun kassir/sotuvchiga
 * berilmaydi (ekrandagi cheklov bilan bir xil).
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  const qatorlar = await listMahsulotEksport(businessId);
  const format = new URL(request.url).searchParams.get("format");

  if (format === "xlsx") {
    const buffer = await buildMahsulotlarWorkbook(qatorlar);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mahsulotlar.xlsx"`,
      },
    });
  }

  const csv = csvYasa(EKSPORT_SARLAVHASI, qatorlar.map(eksportQatoriMassiv));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mahsulotlar.csv"`,
    },
  });
}, { module: "OMBOR" });
