import { getTodayTotals } from "@/lib/queries/shift";
import { listTransactions } from "@/lib/queries/transactions";
import { todayDateOnlyString } from "@/lib/date";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import type { SessionData } from "@/lib/auth/session";
import { KassaHome } from "./KassaHome";

/**
 * KASSIR / SOTUVCHI BOSH EKRANI — direktor paneli EMAS (REDESIGN.md 5.1).
 *
 * Alohida faylda, chunki `page.tsx` da ikkita butunlay boshqa ekran bitta
 * funksiyada turgan edi. Bu yerdagi mantiq O'ZGARMAGAN: bugungi jami ham,
 * lenta ham FAQAT foydalanuvchining o'z yozuvlaridan (`transactionScopeUserId`).
 */
export async function XodimEkrani({ session }: { session: Required<SessionData> }) {
  const businessId = await resolveActiveBusinessId(session);
  const business = await getActiveBusiness(session);
  if (!businessId) {
    return (
      <div className="max-w-lg mx-auto">
        <p className="text-muted">Sizga biznes biriktirilmagan. Admin bilan bog&apos;laning.</p>
      </div>
    );
  }

  const today = todayDateOnlyString();
  const scopeUserId = transactionScopeUserId(session);
  const [bugun, recentRes] = await Promise.all([
    getTodayTotals(businessId, today, scopeUserId),
    listTransactions({ businessId, userId: scopeUserId, page: 1, pageSize: 12 }),
  ]);

  const recent = recentRes.items.map((t) => ({
    id: t.id,
    sana: t.sana instanceof Date ? t.sana.toISOString() : String(t.sana),
    turi: t.turi,
    summa: t.summa,
    categoryNomi: t.category.nomi,
    izoh: t.izoh,
    userIsm: t.user.ism,
    // Kg savdosi: "100 kg × 5 000" qatori lentada ham ko'rinadi (mijozga xos).
    miqdorGr: t.miqdorGr,
    kgNarxi: t.kgNarxi,
  }));

  return (
    <KassaHome
      ism={session.ism}
      rol={session.rol}
      businessNomi={business?.nomi ?? "—"}
      bugun={bugun}
      recent={recent}
    />
  );
}
