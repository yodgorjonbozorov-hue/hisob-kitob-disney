import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { kgSavdoKorinadi } from "@/lib/mijozXos";
import { getKgSavdo } from "@/lib/queries/selos";
import { getAccountBalances } from "@/lib/queries/accounts";
import { todayTashkentDateOnlyString } from "@/lib/date";
import { KgSavdoHisobotView } from "./KgSavdoHisobotView";

export const dynamic = "force-dynamic";

/**
 * KG SAVDOSI SAHIFASI (mijozga xos — Fortex Selos, lib/mijozXos.ts).
 *
 * Bir kunlik kesim: jami kg, jami savdo, o'rtacha narx; sotuvchi, kassa va
 * kategoriya bo'yicha taqsimot; pastida har bir savdo (miqdor × narx = jami).
 * Yangi balans tizimi YO'Q — barcha raqamlar `Transaction` yozuvlaridan.
 */
export default async function SelosPage({ searchParams }: { searchParams?: { sana?: string } }) {
  const ctx = await requireTenantPage();
  const { session, tenantId, tenant } = ctx;

  // Boshqa mijozlarda bu sahifa umuman yo'q (menyuda ham ko'rinmaydi).
  if (!kgSavdoKorinadi(tenant)) redirect("/app");

  return runWithTenant(tenantId, async () => {
    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-fg">Kg savdosi</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const bugun = todayTashkentDateOnlyString();
    const soralgan = searchParams?.sana;
    const sana = soralgan && /^\d{4}-\d{2}-\d{2}$/.test(soralgan) ? soralgan : bugun;

    // Kassa QOLDIG'I ataylab alohida so'rovdan: kg savdosi kassa balansini
    // hisoblamaydi (u ledger'dan keladi), shu yerda faqat yonma-yon
    // ko'rsatiladi — "kassada qancha pul bor" va "bugun necha kg sotildi".
    const [hisobot, qoldiqlar] = await Promise.all([
      getKgSavdo(businessId, sana),
      getAccountBalances(businessId),
    ]);
    const kassaPuli: Record<string, number> = {};
    for (const q of qoldiqlar) kassaPuli[q.id] = q.qoldiq;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Kg savdosi</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Narx har
            savdoda erkin: miqdor × 1 kg narxi = tushum
          </p>
        </div>
        <KgSavdoHisobotView hisobot={hisobot} sana={sana} bugun={bugun} kassaPuli={kassaPuli} />
      </div>
    );
  });
}
