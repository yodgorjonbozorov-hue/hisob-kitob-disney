import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { isPro } from "@/lib/billing/pro";
import { listXodimlar, xodimSanoqlari } from "@/lib/queries/xodimlar";
import { UsersClient } from "./UsersClient";

/** Birinchi sahifada nechta xodim ko'rsatiladi (qolgani sahifalab olinadi). */
const SAHIFA_HAJMI = 50;

export default async function FoydalanuvchilarPage() {
  const { session, tenantId, tenant } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
    if (!isManager(session.rol)) {
      redirect("/app");
    }

    const pro = isPro(tenant.plan);
    // Birinchi sahifa SERVERDA tayyorlanadi — ochilishi bilan ro'yxat ko'rinadi.
    // Qidiruv/filtr esa `/api/users` orqali, ya'ni butun ro'yxat brauzerga
    // yuklanmaydi (500+ xodimli kompaniyada bu muhim).
    const [royxat, sanoq, businesses, roles] = await Promise.all([
      listXodimlar({ page: 1, pageSize: SAHIFA_HAJMI }),
      xodimSanoqlari(),
      prisma.business.findMany({
        where: { isActive: true },
        orderBy: { nomi: "asc" },
        select: { id: true, nomi: true },
      }),
      // Maxsus rollar — PRO tarifda; boshqa tariflarda bo'sh ro'yxat.
      pro
        ? prisma.role.findMany({
            where: { deletedAt: null, isActive: true },
            select: { id: true, nomi: true, izoh: true },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
    ]);

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-fg">Foydalanuvchilar</h1>
            <p className="text-sm text-muted mt-0.5">
              Xodimlar va ularning ruxsatlarini boshqaring
            </p>
          </div>
        </div>

        <UsersClient
          boshlangich={{ ...royxat, sanoq, pageSize: SAHIFA_HAJMI }}
          currentUserId={session.userId}
          businesses={businesses}
          maxsusRollar={roles}
          pro={pro}
        />
      </div>
    );
  });
}
