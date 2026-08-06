import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { getReceiptData } from "@/lib/queries/receipt";
import { ReceiptDocument } from "@/lib/pdf/ReceiptDocument";

/** Sotuv cheki — 80 mm termal printer formatidagi PDF. */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    forbidSeller(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const data = await getReceiptData(businessId, params.id);
    if (!data) return NextResponse.json({ error: "Sotuv topilmadi" }, { status: 404 });

    const buffer = await renderToBuffer(ReceiptDocument({ data }));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="chek-${params.id.slice(-8)}.pdf"`,
      },
    });
  },
  { module: "OMBOR" }
);
