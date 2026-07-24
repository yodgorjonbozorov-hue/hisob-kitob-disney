import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getAccessibleBusinesses, resolveActiveBusinessId } from "@/lib/business";
import Sidebar from "@/components/nav/Sidebar";
import MobileNav from "@/components/nav/MobileNav";
import { BottomNav } from "@/components/nav/BottomNav";
import { ToastProvider } from "@/components/ui/Toast";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar
        ism={session.ism}
        rol={session.rol}
        businesses={navBusinesses}
        activeBusinessId={activeBusinessId}
        omborli={activeOmborli}
      />
      <MobileNav
        ism={session.ism}
        rol={session.rol}
        businesses={navBusinesses}
        activeBusinessId={activeBusinessId}
        omborli={activeOmborli}
      />
      <main className="flex-1 p-4 md:p-8 pb-24 lg:pb-8">
        <ToastProvider>{children}</ToastProvider>
      </main>
      <BottomNav ism={session.ism} rol={session.rol} omborli={activeOmborli} />
    </div>
  );
}
