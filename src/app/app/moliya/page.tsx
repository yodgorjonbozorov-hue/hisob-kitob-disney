import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId } from "@/lib/business";
import { isManager } from "@/lib/auth/roles";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { hasPermission } from "@/lib/permissions/tekshir";
import { listPulHarakatlari } from "@/lib/queries/moliya";
import { listAccounts } from "@/lib/queries/accounts";
import { MoliyaClient } from "./MoliyaClient";

/**
 * MOLIYA — "Pul oldim / Pul berdim".
 *
 * Kirim/Chiqim sahifasi (`/app/tranzaksiyalar`) o'z o'rnida qoladi: u
 * ANALITIK ko'rinish (kategoriya kesimi, filtrlar, eksport, kg savdosi).
 * Bu sahifa esa TEZ KIRITISH oqimi — ikkita tugma va bitta ro'yxat.
 * Ikkalasi AYNI ma'lumotni o'qiydi (`listTransactions`), shuning uchun
 * ular hech qachon ikki xil raqam ko'rsatmaydi.
 */
export default async function MoliyaPage() {
  const { session, tenantId } = await requireTenantPage();
  return runWithTenant(tenantId, async () => {
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Moliya</h1>
          <p className="text-muted">Sizga biznes biriktirilmagan. Admin bilan bog&apos;laning.</p>
        </div>
      );
    }

    const [royxat, kassalar, kategoriyalar, jamiKorish] = await Promise.all([
      listPulHarakatlari({
        businessId,
        // Xodim faqat o'zi kiritgan yozuvlarni ko'radi (lib/auth/visibility.ts).
        userId: transactionScopeUserId(session),
        pageSize: 30,
      }),
      listAccounts(businessId, true),
      prisma.category.findMany({
        where: { businessId, isActive: true },
        select: { id: true, nomi: true, turi: true },
        orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
      }),
      // Davr yakuni — Kirim/Chiqim sahifasi bilan AYNI huquq.
      hasPermission(session.userId, "hisobot.korish"),
    ]);

    return (
      <MoliyaClient
        boshlangichItems={royxat.items}
        boshlangichTotals={
          jamiKorish
            ? {
                jamiKirim: royxat.totals.jamiKirim,
                jamiChiqim: royxat.totals.jamiChiqim,
                sof: royxat.totals.sof,
              }
            : null
        }
        kassalar={kassalar.map((k) => ({ id: k.id, nomi: k.nomi, turi: k.turi }))}
        kategoriyalar={kategoriyalar}
        boshqaruvchi={isManager(session.rol)}
      />
    );
  });
}
