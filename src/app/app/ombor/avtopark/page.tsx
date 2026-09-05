import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { isManager } from "@/lib/auth/roles";
import { getActiveBusiness } from "@/lib/business";
import { listProducts, getOmborStats, getProductProfitability, type ProductAdminDTO } from "@/lib/queries/inventory";
import { AvtoparkClient } from "./AvtoparkClient";
import { Card } from "@/components/ui/Card";
import { formatSomLabel } from "@/lib/format";
import { omborMatn, isAvto } from "@/lib/biznesTuri";

/**
 * AVTOPARK — avto (olib-sotar) bizneslar uchun ESKI Ombor ko'rinishi.
 *
 * Yangi Ombor sahifasi (rasmli kartochka gridi, "+ Omborga ta'minot" oqimi,
 * ta'minotchi tanlash) tovar OQIMI bilan ishlaydigan biznes uchun
 * qurilgan: bir xil mahsulot yuz marta keladi va ketadi. Avtoparkda esa
 * har yozuv YAGONA mashina — u yerda kartochka gridi ham, miqdor kiritish
 * ham ortiqcha. Shu bois avto rejimi o'z jadvali va "sof foyda" hisobi
 * bilan avvalgidek qoladi.
 */

export default async function AvtoparkPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  // OMBOR moduli yoqilmagan bo'lsa — asosiy sahifaga.
  await requireModulePage(ctx, "OMBOR");
  if (!isManager(session.rol)) {
    redirect("/app");
  }
  const business = await getActiveBusiness(session);
  if (!business || !business.omborli) {
    redirect("/app");
  }
  // Bu sahifa FAQAT avto (olib-sotar) rejimi uchun: u yerda mahsulot
  // kartochkasi ham, qadam-baqadam ta'minot oqimi ham ma'nosiz — bitta
  // mashina bitta yozuv. Oddiy biznes yangi Ombor ko'rinishiga qaytariladi.
  if (!isAvto(business.turi)) {
    redirect("/app/ombor");
  }

  const [products, stats, profit] = await Promise.all([
    listProducts(business.id, { forKassir: false }) as Promise<ProductAdminDTO[]>,
    getOmborStats(business.id),
    getProductProfitability(business.id),
  ]);

  const M = omborMatn(business.turi);
  const avto = isAvto(business.turi);
  // Sotilganlar bo'yicha yakun — "sof foyda" ko'rsatkichi (avto rejimida ayniqsa muhim).
  const jami = profit.reduce(
    (a, p) => ({
      sotilgan: a.sotilgan + p.sotilgan,
      daromad: a.daromad + p.daromad,
      tannarx: a.tannarx + p.tannarx,
      xarajat: a.xarajat + p.xarajat,
      foyda: a.foyda + p.foyda,
    }),
    { sotilgan: 0, daromad: 0, tannarx: 0, xarajat: 0, foyda: 0 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-fg">{M.modul}</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business.nomi}</span>
        </p>
      </div>
      <AvtoparkClient initialProducts={products} stats={stats} biznesTuri={business.turi} />

      {profit.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <p className="text-muted text-sm mb-1">{avto ? "Sotilgan mashinalar" : "Sotilgan (dona)"}</p>
            <p className="text-xl font-semibold text-fg tnum">{jami.sotilgan}</p>
          </Card>
          <Card>
            <p className="text-muted text-sm mb-1">Sotuvdan tushum</p>
            <p className="text-xl font-semibold text-fg tnum">{formatSomLabel(jami.daromad)}</p>
          </Card>
          <Card>
            <p className="text-muted text-sm mb-1">{avto ? "Mashinalar tannarxi" : "Tannarx"}</p>
            <p className="text-xl font-semibold text-fg tnum">{formatSomLabel(jami.tannarx)}</p>
            {jami.xarajat > 0 && (
              <p className="text-2xs text-muted mt-1">
                + {formatSomLabel(jami.xarajat)} xarajat
              </p>
            )}
          </Card>
          <Card>
            <p className="text-muted text-sm mb-1">Sof foyda</p>
            <p className={`text-xl font-semibold tnum ${jami.foyda >= 0 ? "text-income" : "text-expense"}`}>
              {formatSomLabel(jami.foyda)}
            </p>
          </Card>
        </div>
      )}

      {profit.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <h2 className="font-semibold text-fg px-5 pt-5 pb-3">{M.foydaSarlavha}</h2>
          <div className="jadval-siljish">
            <table className="w-full text-sm min-w-[38rem]">
              <thead className="bg-surface-2 text-muted text-xs uppercase">
                <tr>
                  <th className="text-left px-5 py-2">{avto ? "Mashina" : "Mahsulot"}</th>
                  <th className="text-right px-3 py-2">{M.sotilgan}</th>
                  <th className="text-right px-3 py-2">{avto ? "Sotilgan narx" : "Daromad"}</th>
                  {avto && <th className="text-right px-3 py-2">Xarajat</th>}
                  <th className="text-right px-3 py-2">{avto ? "Sof foyda" : "Foyda"}</th>
                  <th className="text-right px-5 py-2">Marja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {profit.map((p) => (
                  <tr key={p.productId}>
                    <td className="px-5 py-2.5 font-medium">
                      {p.nomi}
                      {p.foyda < 0 && <span className="ml-2 text-2xs text-expense">zararga</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tnum">{p.sotilgan}</td>
                    <td className="px-3 py-2.5 text-right tnum">{formatSomLabel(p.daromad)}</td>
                    {avto && (
                      <td className="px-3 py-2.5 text-right tnum text-muted">
                        {p.xarajat > 0 ? formatSomLabel(p.xarajat) : "—"}
                      </td>
                    )}
                    <td className={`px-3 py-2.5 text-right tnum font-medium ${p.foyda >= 0 ? "text-income" : "text-expense"}`}>
                      {formatSomLabel(p.foyda)}
                    </td>
                    <td className={`px-5 py-2.5 text-right tnum ${p.marja >= 0 ? "text-muted" : "text-expense"}`}>{p.marja}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
  });
}
