import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { getAccessibleBusinesses, resolveActiveBusinessId } from "@/lib/business";
import { getNotificationCount } from "@/lib/queries/notifications";
import { getEnabledModules } from "@/lib/modules/guard";
import { computeNav, computeMobileTabs } from "@/lib/modules/registry";
import { isAvto } from "@/lib/biznesTuri";
import Sidebar from "@/components/nav/Sidebar";
import MobileNav from "@/components/nav/MobileNav";
import { BottomNav } from "@/components/nav/BottomNav";
import { ToastProvider } from "@/components/ui/Toast";
import { CommandPalette } from "@/components/CommandPalette";
import { BillingBanner } from "@/components/BillingBanner";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId, access } = ctx;
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  // Boshlang'ich parolni majburiy almashtirish.
  if (session.mustChangePassword) {
    redirect("/parol-ozgartirish");
  }
  const [businesses, activeBusinessId, yoqilganModullar] = await Promise.all([
    getAccessibleBusinesses(session),
    resolveActiveBusinessId(session),
    getEnabledModules(ctx),
  ]);
  const navBusinesses = businesses.map((b) => ({ id: b.id, nomi: b.nomi }));
  // Aktiv biznes omborli bo'lsa — Ombor/Sotuv/Qarzlar menyulari ko'rsatiladi.
  const activeBusiness = businesses.find((b) => b.id === activeBusinessId);
  const activeOmborli = activeBusiness?.omborli ?? false;
  const activeAvto = isAvto(activeBusiness?.turi);
  const notifCount = activeBusinessId
    ? await getNotificationCount(activeBusinessId, { rol: session.rol, omborli: activeOmborli }).catch(() => 0)
    : 0;

  // Navigatsiya modul registry'sidan generatsiya qilinadi — BITTA manba.
  const navHolati = {
    rol: session.rol,
    yoqilgan: yoqilganModullar,
    omborli: activeOmborli,
    avto: activeAvto,
  };
  const navItems = computeNav(navHolati);
  const mobileTabs = computeMobileTabs(navHolati);
  const menyu = navItems.map((n) => ({ label: n.label, href: n.href }));

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar
          ism={session.ism}
          rol={session.rol}
          businesses={navBusinesses}
          activeBusinessId={activeBusinessId}
          navItems={navItems}
          notifCount={notifCount}
        />
        <MobileNav
          ism={session.ism}
          rol={session.rol}
          businesses={navBusinesses}
          activeBusinessId={activeBusinessId}
          omborli={activeOmborli}
          notifCount={notifCount}
        />
        <main className="flex-1 p-4 md:p-8 pb-24 lg:pb-8">
          {session.impersonatedBy && <ImpersonationBanner ism={session.ism} />}
          <BillingBanner access={access} />
          {children}
        </main>
        <BottomNav ism={session.ism} rol={session.rol} tabs={mobileTabs} menyu={menyu} />
        <CommandPalette
          rol={session.rol}
          navItems={menyu}
          businesses={navBusinesses}
          activeBusinessId={activeBusinessId}
        />
      </div>
    </ToastProvider>
  );
  });
}
