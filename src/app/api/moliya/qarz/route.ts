import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { requirePermission } from "@/lib/permissions/tekshir";
import { shaxsQarzi } from "@/lib/services/pulOqimi";
import { qarzdorKalit } from "@/lib/queries/qarz";
import { isShaxsTuri, qarzYonalishi } from "@/lib/moliya/shaxs";

/**
 * TANLANGAN TOMONNING JORIY QARZI (10-talab: "To'lovdan keyin" ko'rinishi).
 *
 * Faqat O'QIYDI. Qarz mijozda kartochkaga, qolganlarida esa ISMGA bog'lanadi
 * — kalit `qarzdorKalit()` bilan bir xil qoidada quriladi, aks holda forma
 * bir qoldiqni ko'rsatib, to'lov boshqasiga tushardi.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  await requirePermission(user.userId, "tranzaksiya.yaratish");

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ qarz: 0, soni: 0 });

  const sp = new URL(request.url).searchParams;
  const shaxsTuri = sp.get("shaxsTuri");
  const yonalish = sp.get("yonalish");
  const ism = (sp.get("ism") ?? "").trim();
  const contactId = sp.get("contactId");

  if (!isShaxsTuri(shaxsTuri) || (yonalish !== "kirim" && yonalish !== "chiqim")) {
    return NextResponse.json({ qarz: 0, soni: 0 });
  }
  if (!ism && !contactId) return NextResponse.json({ qarz: 0, soni: 0 });

  const kalit =
    shaxsTuri === "mijoz" && contactId ? qarzdorKalit(contactId, ism) : qarzdorKalit(null, ism);
  return NextResponse.json(
    await shaxsQarzi(businessId, qarzYonalishi(shaxsTuri, yonalish), kalit)
  );
});
