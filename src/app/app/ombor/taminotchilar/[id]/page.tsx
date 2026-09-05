import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { listAccounts } from "@/lib/queries/accounts";
import { taminotchiProfil } from "@/lib/queries/taminotchi";
import { TaminotchiProfilClient } from "./TaminotchiProfilClient";

/**
 * TA'MINOTCHI PROFILI — "u bilan hisob-kitobimiz qanday?"
 *
 * Ro'yxatdagi qator faqat jami xaridni ko'rsatardi; qarzimiz qancha va
 * oxirgi marta qachon tovar olganimiz esa boshqa bo'limlarda edi. Bu sahifa
 * ikkalasini bir joyga yig'adi va qarzni AYNI SHU YERDAN to'lash imkonini
 * beradi (mavjud "Men qarzdorman" to'lov oqimi orqali).
 */
export default async function TaminotchiPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "OMBOR");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) redirect("/app/ombor/taminotchilar");

    const [natija, kassalar] = await Promise.all([
      taminotchiProfil(businessId, params.id),
      listAccounts(businessId, true),
    ]);
    if (!natija) notFound();

    return (
      <div className="space-y-4 pb-24 lg:pb-0">
        <Link
          href="/app/ombor/taminotchilar"
          className="text-sm text-brand hover:underline inline-block"
        >
          &larr; Ta&apos;minotchilar
        </Link>
        <TaminotchiProfilClient
          profil={natija.profil}
          tarix={natija.tarix}
          kassalar={kassalar}
        />
      </div>
    );
  });
}
