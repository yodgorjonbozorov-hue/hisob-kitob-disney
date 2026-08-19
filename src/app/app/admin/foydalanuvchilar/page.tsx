import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { isPro } from "@/lib/billing/pro";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getUserMoliya } from "@/lib/queries/userMoliya";
import { UsersClient } from "./UsersClient";

export default async function FoydalanuvchilarPage() {
  const { session, tenantId, tenant } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  if (!isManager(session.rol)) {
    redirect("/app");
  }

  const pro = isPro(tenant.plan);
  const [users, businesses, roles] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        ism: true,
        login: true,
        rol: true,
        isActive: true,
        createdAt: true,
        businessId: true,
        business: { select: { nomi: true } },
        // Ko'p-bizneslik: xodim biriktirilgan barcha bizneslar.
        bizneslar: { select: { businessId: true } },
        roleId: true,
        role: { select: { nomi: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.business.findMany({ where: { isActive: true }, orderBy: { nomi: "asc" }, select: { id: true, nomi: true } }),
    // Maxsus rollar — PRO tarifda; boshqa tariflarda bo'sh ro'yxat (select yashiriladi).
    pro
      ? prisma.role.findMany({
          where: { deletedAt: null, isActive: true },
          select: { id: true, nomi: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Balans/qarz/amallar — JORIY biznes kesimida (kassa va qarz biznesga bog'langan).
  // Biznes tanlanmagan bo'lsa ustunlar ko'rsatilmaydi (raqamsiz ustun chalg'itardi).
  const businessId = await resolveActiveBusinessId(session);
  const business = businessId ? await getActiveBusiness(session) : null;
  const moliya = businessId ? await getUserMoliya(businessId) : null;

  const usersDTO = users.map((u) => ({
    id: u.id,
    ism: u.ism,
    login: u.login,
    rol: u.rol,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    businessId: u.businessId,
    businessNomi: u.business?.nomi ?? null,
    businessIds: u.bizneslar.map((b) => b.businessId),
    roleId: u.roleId,
    rolNomi: u.role?.nomi ?? null,
    balans: moliya?.get(u.id)?.balans ?? 0,
    qarz: moliya?.get(u.id)?.qarz ?? 0,
    amallar: moliya?.get(u.id)?.amallar ?? 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-fg">Foydalanuvchilar</h1>
      <UsersClient
        initialUsers={usersDTO}
        currentUserId={session.userId}
        businesses={businesses}
        customRoles={roles}
        pro={pro}
        moliyaBiznes={business?.nomi ?? null}
      />
    </div>
  );
  });
}
