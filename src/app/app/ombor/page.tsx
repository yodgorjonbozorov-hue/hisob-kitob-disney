import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { isManager } from "@/lib/auth/roles";
import { getActiveBusiness } from "@/lib/business";
import { isAvto } from "@/lib/biznesTuri";
import { listAccounts } from "@/lib/queries/accounts";
import { listSuppliers } from "@/lib/queries/xarid";
import {
  listOmborKategoriyalar,
  listOmborMahsulotlar,
  listTaminotlar,
  omborKpi,
} from "@/lib/queries/ombor";
import { listStockAdjustments } from "@/lib/queries/inventory";
import { OmborSahifa } from "./OmborSahifa";
import { OMBOR_TABLAR, type OmborTab } from "./tablar";

/**
 * OMBOR — mahsulot, ta'minot va inventarizatsiya BITTA modulda.
 *
 * Ilgari bu uchta joyga bo'lingan edi: Ombor (jadval), Xarid (buyurtma) va
 * Ta'minotchilar (reyestr). Foydalanuvchi "tovar keldi" deyish uchun avval
 * qaysi bo'limga borishni bilishi kerak edi, keyin uch qadamli buyurtma
 * oqimini o'tishi kerak edi. Endi hammasi shu sahifada, asosiy amal esa
 * bitta tugma — "+ Tovar keldi".
 *
 * SERVER TOMONDA faqat KO'RINADIGAN sahifa yuklanadi: mahsulotlar
 * `listOmborMahsulotlar` bilan sahifalanadi (1000+ tovarda ham brauzerga
 * 24 ta kartochka boradi), qidiruv va filtr ham bazada bajariladi.
 */
const SAHIFA_HAJMI = 24;

export default async function OmborPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga cheklanadi.
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "OMBOR");
    if (!isManager(session.rol)) redirect("/app");

    const business = await getActiveBusiness(session);
    if (!business || !business.omborli) redirect("/app");

    // AVTO rejimi (olib-sotar avtopark) — mahsulot kartochkasi, ta'minotchi
    // va qadam-baqadam ta'minot oqimi u yerda ma'nosiz: bitta mashina bitta
    // yozuv, narx har safar savdolashib belgilanadi. Shu bois avto bizneslar
    // eski ko'rinishda qoladi.
    if (isAvto(business.turi)) redirect("/app/ombor/avtopark");

    const tab: OmborTab = OMBOR_TABLAR.some((t) => t.kalit === searchParams?.tab)
      ? (searchParams!.tab as OmborTab)
      : "mahsulotlar";

    const [kpi, kategoriyalar, royxat, taminotchilar, kassalar] = await Promise.all([
      omborKpi(business.id),
      listOmborKategoriyalar(business.id),
      listOmborMahsulotlar(business.id, {
        q: null,
        categoryId: null,
        holat: "barchasi",
        sahifa: 1,
        limit: SAHIFA_HAJMI,
      }),
      listSuppliers(business.id, true),
      listAccounts(business.id, true),
    ]);

    // Faqat ochiq tab uchun ma'lumot yuklanadi — yopiq tabning so'rovlari
    // har ochilishda bekorga ketardi.
    const taminotlar =
      tab === "taminotlar" ? await listTaminotlar(business.id, { limit: 20 }) : null;
    const togrilashlar = tab === "inventarizatsiya" ? await listStockAdjustments(business.id, 30) : null;

    return (
      <OmborSahifa
        tab={tab}
        biznesNomi={business.nomi}
        kpi={kpi}
        kategoriyalar={kategoriyalar}
        boshlangichRoyxat={royxat}
        taminotchilar={taminotchilar}
        kassalar={kassalar}
        taminotlar={taminotlar}
        togrilashlar={togrilashlar}
      />
    );
  });
}
