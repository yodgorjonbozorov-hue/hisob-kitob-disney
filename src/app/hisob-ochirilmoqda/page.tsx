import { requireOchirishPage } from "@/lib/auth/tenant";
import { OYLASH_KUNI, qolganKun } from "@/lib/db/hisobOchirish";
import { formatDateUZ } from "@/lib/format";
import { Logo } from "@/components/Logo";
import { OchirishBekorTugma } from "./OchirishBekorTugma";

export const metadata = { title: "Hisob o'chirilmoqda" };

/**
 * O'chirish so'ralgandan keyin foydalanuvchi ko'radigan YAGONA sahifa.
 * Ish ekranlari yopiq (lib/auth/tenant.ts), lekin fikridan qaytish yo'li
 * ochiq turadi — bu App Store talabi emas, oddiy insof.
 */
export default async function HisobOchirilmoqdaPage() {
  const { session, tenant } = await requireOchirishPage();
  // `requireOchirishPage` null bo'lsa /app ga yuboradi — bu yerda doim sana bor.
  const soralgan = tenant.deletionRequestedAt as Date;
  const qoldi = qolganKun(soralgan);
  const ochiriladi = new Date(soralgan.getTime() + OYLASH_KUNI * 24 * 60 * 60 * 1000);
  const ega = session.rol === "OWNER";

  return (
    <div className="min-h-screen bg-app px-4 py-12">
      <div className="max-w-lg mx-auto space-y-6">
        <Logo variant="full" height={32} />

        <div className="bg-surface rounded-2xl border border-expense/40 shadow-card p-6 space-y-4">
          <h1 className="font-heading text-xl font-bold text-fg">Hisob o&apos;chirilmoqda</h1>

          <p className="text-sm text-muted">
            <span className="font-medium text-fg">{tenant.name}</span> kompaniyasining hisobini
            o&apos;chirish so&apos;raldi ({formatDateUZ(soralgan)}). Shu sababli ilova vaqtincha
            yopilgan.
          </p>

          <div className="rounded-xl bg-expense-soft text-expense-fg px-4 py-3 text-sm">
            Barcha ma&apos;lumotlar{" "}
            <span className="font-semibold">{formatDateUZ(ochiriladi)}</span> kuni butunlay
            o&apos;chiriladi — yozuvlar, ombor, hisobotlar va xodimlar hisoblari. Buni keyin
            tiklab bo&apos;lmaydi.
            {qoldi > 0 && <> Hozircha {qoldi} kun qoldi.</>}
          </div>

          {ega ? (
            <>
              <p className="text-sm text-muted">
                Fikringizdan qaytgan bo&apos;lsangiz, o&apos;chirishni hozir bekor qiling —
                hamma narsa avvalgidek ishlaydi.
              </p>
              <OchirishBekorTugma />
            </>
          ) : (
            <p className="text-sm text-muted">
              Buni faqat kompaniya egasi bekor qila oladi. Xato bo&apos;lgan deb
              hisoblasangiz, direktoringizga murojaat qiling.
            </p>
          )}
        </div>

        <div className="text-center">
          <a href="/api/auth/logout" className="text-sm text-muted underline underline-offset-4">
            Hisobdan chiqish
          </a>
        </div>
      </div>
    </div>
  );
}
