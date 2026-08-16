import Link from "next/link";
import { requireTenantPage } from "@/lib/auth/tenant";
import { IlovaQulfiSozlama } from "./IlovaQulfiSozlama";
import { HisobOchirish } from "./HisobOchirish";

export const metadata = { title: "Sozlamalar" };

/**
 * Shaxsiy sozlamalar — har rol ko'radi.
 *
 *  - Ilova qulfi: faqat iOS ilovasida ko'rinadi (qurilma imkoniyati).
 *  - Hisobni o'chirish: faqat kompaniya egasiga. App Store 5.1.1(v) bo'yicha
 *    o'chirish ilova ichidan boshlanishi va TOPISH OSON bo'lishi shart —
 *    shuning uchun menyudagi "Sozlamalar" bo'limida, birinchi ekranda.
 */
export default async function SozlamalarPage() {
  const { session, tenant } = await requireTenantPage();
  const ega = session.rol === "OWNER";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-fg">Sozlamalar</h1>
        <p className="text-sm text-muted mt-1">{tenant.name}</p>
      </div>

      {/* Faqat native ilovada ko'rinadi — brauzerda o'zini ko'rsatmaydi. */}
      <IlovaQulfiSozlama />

      {ega && (
        <Link
          href="/app/sozlamalar/modullar"
          className="block bg-surface rounded-2xl border border-line shadow-card p-5 hover:border-line-strong transition-colors"
        >
          <p className="font-semibold text-fg">Modullar</p>
          <p className="text-sm text-muted mt-1">
            Ombor, Xarid, CRM, Xodimlar va boshqa bo&apos;limlarni yoqish yoki o&apos;chirish.
          </p>
        </Link>
      )}

      {ega && <HisobOchirish kompaniyaNomi={tenant.name} />}
    </div>
  );
}
