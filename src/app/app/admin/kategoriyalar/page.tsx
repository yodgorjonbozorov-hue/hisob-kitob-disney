import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { getActiveBusiness } from "@/lib/business";
import { kgSavdoKorinadi } from "@/lib/mijozXos";
import { kategoriyaRoyxati } from "@/lib/services/kategoriya";
import { currentMonthString, parseMonthString } from "@/lib/date";
import { formatMonthLabel } from "@/lib/format";
import { CategoriesClient } from "./CategoriesClient";

export default async function KategoriyalarPage() {
  const { session, tenantId, tenant } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  if (!isManager(session.rol)) {
    redirect("/app");
  }

  const activeBusiness = await getActiveBusiness(session);
  if (!activeBusiness) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Kategoriyalar</h1>
        <p className="text-muted">Hali biznes yaratilmagan. Bizneslar bo&apos;limidan qo&apos;shing.</p>
      </div>
    );
  }

  // Joriy oy — ro'yxatdagi "davr summasi" ustuni SHU oyga tegishli. Sahifa
  // hisobot sahifasiga aylanmasligi uchun davr tanlagichi ATAYLAB yo'q:
  // raqam ikkinchi darajali ma'lumot, sarlavhada oy nomi ochiq yozilgan.
  const oy = currentMonthString();
  const { year, monthIndex0 } = parseMonthString(oy);

  const kategoriyalar = await kategoriyaRoyxati(activeBusiness.id, oy);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Kategoriyalar</h1>
        <p className="text-sm text-muted mt-1">Kirim va chiqim kategoriyalarini boshqaring</p>
      </div>
      {/* Kg savdosi bayrog'i — mijozga xos (Fortex Selos). Boshqa mijozlarda
          bu ustun/tugma umuman ko'rinmaydi. */}
      <CategoriesClient
        initialCategories={kategoriyalar}
        kgSavdo={kgSavdoKorinadi(tenant)}
        oyNomi={formatMonthLabel(year, monthIndex0)}
      />
    </div>
  );
  });
}
