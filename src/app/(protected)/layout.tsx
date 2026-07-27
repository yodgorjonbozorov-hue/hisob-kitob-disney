import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { getAccessibleBusinesses, resolveActiveBusinessId } from "@/lib/business";
import { getNotificationCount } from "@/lib/queries/notifications";
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
  const { session, tenantId, access } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  // Boshlang'ich parolni majburiy almashtirish.
  if (session.mustChangePassword) {
    redirect("/parol-ozgartirish");
  }
  const [businesses, activeBusinessId] = await Promise.all([
    getAccessibleBusinesses(session),
    resolveActiveBusinessId(session),
  ]);
  const navBusinesses = businesses.map((b) => ({ id: b.id, nomi: b.nomi }));
  // Aktiv biznes omborli bo'lsa — Ombor/Sotuv/Qarzlar menyulari ko'rsatiladi.
  const activeOmborli = businesses.find((b) => b.id === activeBusinessId)?.omborli ?? false;
  const notifCount = activeBusinessId
    ? await getNotificationCount(activeBusinessId, { rol: session.rol, omborli: activeOmborli }).catch(() => 0)
    : 0;

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col md:flex-row">
        <Sidebar
          ism={session.ism}
          rol={session.rol}
          businesses={navBusinesses}
          activeBusinessId={activeBusinessId}
          omborli={activeOmborli}
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
        <BottomNav ism={session.ism} rol={session.rol} omborli={activeOmborli} />
        <CommandPalette
          rol={session.rol}
          omborli={activeOmborli}
          businesses={navBusinesses}
          activeBusinessId={activeBusinessId}
        />
      </div>
    </ToastProvider>
  );
  });
}
