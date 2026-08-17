import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { getActiveBusiness } from "@/lib/business";
import { isManager } from "@/lib/auth/roles";
import { listQarzlar, getQarzDashboard, listQarzdorlar } from "@/lib/queries/qarz";
import { listAccounts } from "@/lib/queries/accounts";
import { listProducts, type ProductAdminDTO } from "@/lib/queries/inventory";
import { QarzlarClient } from "./QarzlarClient";
import type { QarzYonalish } from "./QarzFiltrPanel";

/**
 * QARZLAR SAHIFASI.
 *
 * OMBOR moduli SHARTI OLIB TASHLANDI (avvalgi `requireModulePage(ctx, "OMBOR")`
 * va `business.omborli` tekshiruvi): qarz endi ombordan mustaqil moliyaviy
 * majburiyat va Yozuvlar sahifasidagi "Kirim → Qarz" har qanday biznesda
 * ishlaydi. Mahsulotga bog'lash esa ombor bo'lgandagina taklif qilinadi.
 */
export default async function QarzlarPage({
  searchParams,
}: {
  searchParams: { turi?: string };
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    // Sotuvchi faqat kirim/chiqim kiritadi — bu sahifa unga yopiq.
    if (session.rol === "SELLER") {
      redirect("/app");
    }
    const business = await getActiveBusiness(session);
    if (!business) {
      redirect("/app");
    }

    const omborBor = business.omborli && (await isModuleOnForTenant(tenantId, "OMBOR"));

    const [debts, qarzdorlar, dashboard, kassalar, products] = await Promise.all([
      listQarzlar(business.id),
      listQarzdorlar(business.id),
      getQarzDashboard(business.id),
      listAccounts(business.id, true),
      omborBor
        ? (listProducts(business.id, { forKassir: false }) as Promise<ProductAdminDTO[]>)
        : Promise.resolve([] as ProductAdminDTO[]),
    ]);

    // Qarzni mahsulot/mashinaga bog'lash uchun ro'yxat.
    const productOptions = products.map((p) => ({
      id: p.id,
      nomi: [p.nomi, p.avtoRaqam].filter(Boolean).join(" · "),
    }));

    // Bosh sahifadagi "Menga qarzdor" kartasi `?turi=olinadigan` bilan keladi —
    // sahifa aynan shu yo'nalishda ochilsin.
    const yonalish: QarzYonalish =
      searchParams.turi === "olinadigan" || searchParams.turi === "beriladigan"
        ? searchParams.turi
        : searchParams.turi === "hammasi"
          ? "hammasi"
          : "olinadigan";
    const sarlavha = yonalish === "beriladigan" ? "Men qarzdorman" : "Menga qarzdor";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">{sarlavha}</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business.nomi}</span> · qarz kirim
            emas, pul faqat to&apos;langanda balansga tushadi
          </p>
        </div>
        <QarzlarClient
          initialDebts={debts}
          qarzdorlar={qarzdorlar}
          dashboard={dashboard}
          kassalar={kassalar.map((k) => ({ id: k.id, nomi: k.nomi }))}
          products={productOptions}
          biznesTuri={business.turi}
          bekorQilaOladi={isManager(session.rol)}
          boshlangichYonalish={yonalish}
        />
      </div>
    );
  });
}
