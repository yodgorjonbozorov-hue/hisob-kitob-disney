import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { auditRoyxati, auditFiltrVariantlari } from "@/lib/superadmin/auditQidiruv";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { matn, sana, mantiq } from "@/lib/superadmin/sorovParam";

export const dynamic = "force-dynamic";

/**
 * Audit jurnali — FAQAT O'QISH.
 *
 * Bu resursda ATAYLAB DELETE/PATCH metodi yo'q: jurnal append-only
 * (`lib/db/rawPrisma.ts`). Superadmin ham yozuvni o'chira olmaydi.
 */
export const GET = withSuperadmin(r("audit", "VIEW"), async (request) => {
  const p = new URL(request.url).searchParams;
  const [royxat, variantlar] = await Promise.all([
    auditRoyxati(
      {
        qidiruv: matn(p, "qidiruv"),
        action: matn(p, "amal"),
        entity: matn(p, "entity"),
        userId: matn(p, "userId"),
        tenantId: matn(p, "tenantId"),
        sanadan: sana(p, "sanadan"),
        sanagacha: sana(p, "sanagacha"),
        faqatSuperadmin: mantiq(p, "faqatSuperadmin") === true,
      },
      sahifaParametrlari(p)
    ),
    auditFiltrVariantlari(),
  ]);
  return NextResponse.json({ ...royxat, variantlar });
});
