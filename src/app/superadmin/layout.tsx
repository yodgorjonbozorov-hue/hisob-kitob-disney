import { requireSuperadminPage } from "@/lib/auth/superadmin";
import { navBolimlar } from "@/lib/superadmin/navigatsiya";
import { tizimSoglikCached } from "@/lib/superadmin/tizim";
import { Qobiq } from "@/components/superadmin/Qobiq";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = { title: "Balansa Control Center" };

/**
 * CONTROL CENTER LAYOUT.
 *
 * Guard SHU YERDA: `/superadmin/*` ostidagi HAR sahifa avtomatik
 * himoyalangan — yangi sahifa qo'shganda guard qo'shishni unutish imkonsiz.
 * Bo'limlar ro'yxati rolga qarab qisqaradi (lib/superadmin/navigatsiya.ts).
 */
export default async function ControlCenterLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperadminPage();
  const soglik = await tizimSoglikCached("layout");

  return (
    <ToastProvider>
      <Qobiq
        bolimlar={navBolimlar(session.superRol)}
        ism={session.ism}
        superRol={session.superRol}
        tizimHolat={soglik.umumiy}
      >
        {children}
      </Qobiq>
    </ToastProvider>
  );
}
