import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { getActiveBusiness } from "@/lib/business";
import { isManager } from "@/lib/auth/roles";
import { listKodliMahsulotlar } from "@/lib/queries/pos";
import { qrSvg } from "@/lib/magazin/kod";
import { MAKS_YORLIQ } from "@/lib/magazin/yorliq";
import { ChopClient } from "./ChopClient";

export const metadata = { title: "Yorliqlarni chop etish — Balansa" };

/**
 * YORLIQLARNI OMMAVIY CHOP ETISH (stiker printeri uchun).
 *
 * QR rasmlari SERVERDA chizilib mijozga tayyor SVG sifatida beriladi:
 * shu bilan kassa/QR sahifalarining bundle'iga QR kutubxonasi qo'shilmaydi.
 * Bu sahifa kamdan-kam ochiladi, undagi og'irlik esa kassirning har kunlik
 * ekraniga tegmaydi.
 */
export default async function ChopPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    // Katalogni o'zgartirish/chop etish — boshqaruvchi amali (QR sahifasi bilan bir xil).
    if (!isManager(session.rol)) {
      redirect("/app");
    }
    const [, business] = await Promise.all([
      requireModulePage(ctx, "MAGAZIN"),
      getActiveBusiness(session),
    ]);
    if (!business || !business.magazin || !business.omborli) {
      redirect("/app");
    }

    const hammasi = await listKodliMahsulotlar(business.id);
    // Yorliq faqat BALANSA QR uchun. Zavod shtrix-kodi bor tovarga stiker
    // chop etish ortiqcha — uning kodi allaqachon quti ustida.
    const qrli = hammasi.filter((p) => !!p.qrKod);
    const chiqadi = qrli.slice(0, MAKS_YORLIQ);

    const yorliqlar = chiqadi.map((p) => ({
      id: p.id,
      nomi: p.nomi,
      kod: p.qrKod as string,
      // `olcham` bu yerda ahamiyatsiz: SVG `viewBox` bilan CSS orqali
      // yorliq o'lchamiga cho'ziladi.
      svg: qrSvg(p.qrKod as string, { olcham: 200 }),
    }));

    return (
      <ChopClient
        yorliqlar={yorliqlar}
        biznesNomi={business.nomi}
        jamiQrli={qrli.length}
        kodsizSoni={hammasi.filter((p) => !p.qrKod && !p.barcode).length}
      />
    );
  });
}
