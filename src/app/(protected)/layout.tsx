import { requireUser } from "@/lib/auth/session";
import Sidebar from "@/components/nav/Sidebar";
import MobileNav from "@/components/nav/MobileNav";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar ism={session.ism} rol={session.rol} />
      <MobileNav ism={session.ism} rol={session.rol} />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
