import { redirect } from "next/navigation";
import { getMonthlyReport } from "@/lib/queries/report";
import { currentMonthString } from "@/lib/date";
import { MonthSelector } from "@/components/MonthSelector";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { getEnabledModules } from "@/lib/modules/guard";
import { davrniOqi, getDavriyHisobot } from "@/lib/queries/davriyHisobot";
import { ReportView } from "./ReportView";
import { AiXulosaBox } from "./AiXulosaBox";
import { DavrTablari } from "./DavrTablari";
import { DavriyKorinish } from "./DavriyKorinish";

export default async function HisobotPage({
  searchParams,
}: {
  searchParams: { month?: string; davr?: string };
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  if (!isManager(session.rol)) {
    redirect("/app/tranzaksiyalar");
  }
  const businessId = await resolveActiveBusinessId(session);
  const month = searchParams.month ?? currentMonthString();
  // Sukut — "oylik": mavjud hisobot ko'rinishi va uning eksportlari
  // O'ZGARMAYDI, faqat yoniga yangi davr tablari qo'shildi.
  const davr = davrniOqi(searchParams.davr);

  if (!businessId) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Hisobotlar</h1>
        <p className="text-muted">Hali biznes yaratilmagan.</p>
      </div>
    );
  }

  // AI xulosa bloki: modul yoqiq va kalit sozlangan bo'lsagina ko'rinadi.
  // U OYLIK hisobot uchun yozilgan, shuning uchun faqat o'sha tabda.
  const aiBor = (await getEnabledModules(ctx)).has("AI") && !!process.env.ANTHROPIC_API_KEY;
  const oylikMi = davr === "oylik";
  const [report, davriy] = await Promise.all([
    oylikMi ? getMonthlyReport(businessId, month) : Promise.resolve(null),
    oylikMi ? Promise.resolve(null) : getDavriyHisobot(businessId, month, davr),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Hisobotlar</h1>
        <MonthSelector month={month} qoshimcha={`davr=${davr}`} />
      </div>
      <DavrTablari joriy={davr} month={month} />
      {report ? (
        <>
          {aiBor && <AiXulosaBox month={month} />}
          <ReportView report={report} />
        </>
      ) : (
        davriy && <DavriyKorinish hisobot={davriy} />
      )}
    </div>
  );
  });
}
