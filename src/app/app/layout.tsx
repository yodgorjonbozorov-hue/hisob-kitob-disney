import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { getAccessibleBusinesses, resolveActiveBusinessId } from "@/lib/business";
import { getEnabledModules } from "@/lib/modules/guard";
import { computeNav, computeMobileTabs } from "@/lib/modules/registry";
import { isAvto } from "@/lib/biznesTuri";
import { isPro } from "@/lib/billing/pro";
import { kgSavdoKorinadi } from "@/lib/mijozXos";
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
  // Kassa (POS) menyusi faqat magazin belgilangan bizneste. Bayroq
  // qo'yilmagan (ya'ni barcha mavjud) bizneslarda menyu O'ZGARMAYDI.
  const activeMagazin = activeBusiness?.magazin ?? false;
  // Bildirishnoma soni endi clientda (/api/me/notif-count) yuklanadi —
  // ilgari bu hisob HAR sahifa renderini ~6 ketma-ket DB so'roviga bloklab turardi.

  // Navigatsiya modul registry'sidan generatsiya qilinadi — BITTA manba.
  const navHolati = {
    rol: session.rol,
    yoqilgan: yoqilganModullar,
    omborli: activeOmborli,
    magazin: activeMagazin,
    avto: activeAvto,
    // PRO havolalar (Rollar va huquqlar) faqat PRO mijozda — boshqalar menyusi o'zgarmaydi.
    pro: isPro(ctx.tenant.plan),
    // "Kg savdosi" havolasi — mijozga xos (Fortex Selos), tarif imkoniyati EMAS.
    kgSavdo: kgSavdoKorinadi(ctx.tenant),
  };
  const navItems = computeNav(navHolati);
  const mobileTabs = computeMobileTabs(navHolati);
  const menyu = navItems.map((n) => ({ label: n.label, href: n.href }));

  return (
    <ToastProvider>
      {/* `w-full` + `overflow-x-clip`: keng kontent (jadval) sahifani
          gorizontal siljitmaydi — siljish faqat jadval konteynerida. */}
      {/* `lg:flex-row` (ilgari `md:flex-row`): yon menyu (Sidebar) faqat `lg`
          dan boshlab ko'rinadi, MobileNav esa `lg:hidden`. Qator maketi `md`
          da yoqilganda MobileNav yon ustun bo'lib qolar va planshet (768px)
          kengligida kontentni o'ngga surib yuborardi. */}
      <div className="min-h-screen w-full overflow-x-clip flex flex-col lg:flex-row">
        <Sidebar
          ism={session.ism}
          rol={session.rol}
          businesses={navBusinesses}
          activeBusinessId={activeBusinessId}
          navItems={navItems}
        />
        <MobileNav
          ism={session.ism}
          rol={session.rol}
          businesses={navBusinesses}
          activeBusinessId={activeBusinessId}
          omborli={activeOmborli}
        />
        {/* `min-w-0` — flex bolasi sukut bo'yicha kontentidan kichrayolmaydi;
            usiz bitta keng jadval butun maketni cho'zib yuboradi. */}
        <main className="flex-1 min-w-0 max-w-full p-4 md:p-8 pb-24 lg:pb-8">
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
