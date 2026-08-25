import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId } from "@/lib/business";
import {
  getKunlikReport,
  getKunlikDirektor,
  getKunlikKassa,
  listKunlikKategoriyalar,
  listKunlikOperatsiyalar,
  listKutilayotganKunlar,
} from "@/lib/queries/kunlik";
import { getSmenaHolat } from "@/lib/queries/smena";
import { getKunlikRuxsat, kunlikBugun } from "@/lib/services/kunlik";
import { getKgSavdo } from "@/lib/queries/selos";
import { kgSavdoKorinadi } from "@/lib/mijozXos";
import { KunlikClient } from "./KunlikClient";
import { SelosBugunKartasi } from "../SelosBugunKartasi";

export const dynamic = "force-dynamic";

/**
 * KUNLIK HISOBOT — kun kirimi/chiqimi, smena solishtiruvi va kassa topshirish.
 *
 * Kun Toshkent yarim tunida almashadi. Barcha raqamlar YAGONA manbadan
 * (`Transaction` + `AccountTransfer` ledgeri) hosila: kunlik hisobot
 * alohida daftar yuritmaydi.
 */
export default async function KunlikPage({
  searchParams,
}: {
  searchParams?: { sana?: string };
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "KUNLIK");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Kunlik hisobot</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const aktor = { userId: session.userId, ism: session.ism, rol: session.rol };
    const bugun = kunlikBugun();
    const ruxsat = await getKunlikRuxsat(businessId, aktor);

    // Xodim faqat bugunni ko'radi — boshqa sana so'ralsa jimgina bugunga qaytariladi.
    const soralgan = searchParams?.sana;
    const sana =
      soralgan && /^\d{4}-\d{2}-\d{2}$/.test(soralgan) && ruxsat.tarixniKoradi ? soralgan : bugun;

    // Kg savdosi kesimi — mijozga xos (Fortex Selos). Kunlik hisobot pul
    // bo'yicha yuritiladi; kg ALOHIDA blok bo'lib turadi va tushum
    // summalariga aralashmaydi.
    const kgPanel = kgSavdoKorinadi(ctx.tenant);
    const [report, direktor, smena, kassa, operatsiyalar, kategoriyalar, kutilayotganlar, kgSavdo] =
      await Promise.all([
        getKunlikReport(businessId, sana),
        getKunlikDirektor(businessId),
        getSmenaHolat(businessId, sana, bugun),
        getKunlikKassa(businessId, session.userId),
        listKunlikOperatsiyalar(businessId, sana),
        listKunlikKategoriyalar(businessId),
        ruxsat.tasdiqlaydi ? listKutilayotganKunlar(businessId) : Promise.resolve([]),
        kgPanel ? getKgSavdo(businessId, sana) : Promise.resolve(null),
      ]);

    return (
      <div className="space-y-5">
        {kgSavdo && kgSavdo.savdoSoni > 0 && (
          <SelosBugunKartasi
            hisobot={kgSavdo}
            sarlavha={sana === bugun ? "Bugungi kg savdosi" : "Shu kundagi kg savdosi"}
          />
        )}
        <KunlikClient
          report={report}
          ruxsat={ruxsat}
          bugun={bugun}
          direktor={direktor}
          smena={smena}
          kassa={kassa}
          operatsiyalar={operatsiyalar}
          kategoriyalar={kategoriyalar}
          kutilayotganlar={kutilayotganlar}
        />
      </div>
    );
  });
}
