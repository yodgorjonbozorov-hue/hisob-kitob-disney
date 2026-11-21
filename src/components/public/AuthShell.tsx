import { Card } from "@/components/ui/Card";
import { BRAND_SIGNATURE } from "@/lib/brand";
import { PublicHeader } from "./PublicHeader";
import { AuthBrendPanel } from "./AuthBrendPanel";

/**
 * Kirish / ro'yxatdan o'tish qobig'i.
 *
 * Bu ekranlar telefonga o'rnatilgan ilovada ham ochiladi (manifest `scope: "/"`),
 * shu bois ilova qobig'i bilan bir xil bo'lishi shart: tepada AYNI sticky panel,
 * kontent `Card` ichida (ilovadagi kartalar bilan bir xil radius va soya),
 * pastda `pb-safe` — xavfsiz zona.
 *
 * Katta ekranda (lg+) chapda brend paneli — bo'sh qolgan joy mahsulot nima
 * berishini aytadi. Telefonda panel YO'Q: u yerda forma birinchi ekranda
 * to'liq ko'rinishi muhimroq.
 */
export function AuthShell({
  joriy,
  sarlavha,
  tavsif,
  children,
  ost,
}: {
  /** Ochiq turgan sahifa — panel o'ziga havola bermaydi. */
  joriy: "login" | "signup";
  /** Karta ustidagi sarlavha. */
  sarlavha: string;
  /** Sarlavha ostidagi izoh (ixtiyoriy). */
  tavsif?: React.ReactNode;
  /** Forma. */
  children: React.ReactNode;
  /** Karta ostidagi havola matni. */
  ost?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-app">
      <PublicHeader joriy={joriy} logoToliq />
      <main className="flex-1 flex items-center justify-center px-4 py-10 pb-safe">
        <div className="w-full max-w-sm lg:max-w-4xl lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
          <AuthBrendPanel />
          <div className="w-full max-w-sm mx-auto">
            <div className="text-center mb-6">
              <h1 className="font-heading text-xl font-semibold text-fg">{sarlavha}</h1>
              {tavsif && <p className="text-sm text-muted mt-1.5">{tavsif}</p>}
            </div>
            <Card>{children}</Card>
            {ost && <p className="text-center text-sm text-muted mt-5">{ost}</p>}
            <p className="text-center text-2xs text-faint mt-4">{BRAND_SIGNATURE}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
