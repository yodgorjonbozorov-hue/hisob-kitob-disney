import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { prisma } from "@/lib/prisma";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getBoard } from "@/lib/crm/service";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import { crmFormaKategoriyalari } from "@/lib/services/xodimKategoriya";
import { avtoSotuvchi, sotuvchilarRoyxati, sotuvchiMajburiymi } from "@/lib/services/zakazSotuvchi";
import { hasPermission } from "@/lib/permissions/tekshir";
import { kunlikBuyurtmalar, kategoriyaStatistikasi } from "@/lib/crm/statistika";
import { todayTashkentDateOnlyString, utcDateToDateOnlyString } from "@/lib/date";
import { CrmClient } from "./CrmClient";
import { BugungiPanel } from "./BugungiPanel";

/** CRM — Disney Navoiy kunlik buyurtmalari doskasi. */
export default async function CrmPage() {
  const ctx = await requireTenantPage();
  const { tenantId, session } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "CRM");
    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    const bugun = todayTashkentDateOnlyString();

    if (!businessId) {
      return (
        <div className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">CRM — Buyurtmalar</h1>
          <p className="text-muted">Sizga biznes biriktirilmagan. Admin bilan bog&apos;laning.</p>
        </div>
      );
    }

    const [
      board,
      kategoriyalar,
      xodimlar,
      kunlik,
      kategoriyaStat,
      xodimKategoriyalari,
      sotuvchilar,
      ozim,
      sotuvchiMajburiy,
      sotuvchiOzgartira,
    ] = await Promise.all([
      getBoard(businessId),
      // KATEGORIYA MANBAI BITTA: Kirim modulining kategoriyalari.
      prisma.category.findMany({
        where: { businessId, turi: "kirim", isActive: true },
        select: { id: true, nomi: true },
        orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
      }),
      // MAS'UL XODIM ro'yxati — faqat SHU biznesda ishlaydiganlar. Tenant
      // filtri o'zi yetarli emas: bir kompaniyada bir necha biznes bo'lsa,
      // A biznesining sotuvchisi B biznesining xodimlarini ko'rardi.
      prisma.user.findMany({
        where: { isActive: true, ...biznesXodimlariWhere(businessId) },
        select: { id: true, ism: true },
        orderBy: { ism: "asc" },
      }),
      kunlikBuyurtmalar(businessId, bugun),
      kategoriyaStatistikasi(businessId),
      // Xodim kategoriyalari (Sotuvchi/Diktor/...) — zakaz-xodim biriktiruvi.
      crmFormaKategoriyalari(businessId),
      // SOTUVCHI (1/2-talab): faqat shu biznesning faol sotuvchilari.
      sotuvchilarRoyxati(businessId),
      // Avto-tanlash (4-talab) — foydalanuvchining o'z sotuvchi profili.
      avtoSotuvchi(businessId, session.userId),
      sotuvchiMajburiymi(businessId),
      hasPermission(session.userId, "crm.sotuvchi"),
    ]);

    const ismlar = new Map(xodimlar.map((x) => [x.id, x.ism]));
    const stages = board.stages.map((s) => ({ id: s.id, nomi: s.nomi, turi: s.turi }));

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">CRM — Buyurtmalar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Kunlik
            buyurtmalar va ularning Kirimga o&apos;tishi
          </p>
        </div>

        <BugungiPanel
          kunlik={{
            sana: kunlik.sana,
            jami: kunlik.jami,
            kirimga: kunlik.kirimga,
            kutilmoqda: kunlik.kutilmoqda,
            soni: kunlik.soni,
            qatorlar: kunlik.buyurtmalar.map((b) => ({
              id: b.id,
              nomi: b.nomi,
              kategoriya: b.kategoriya,
              summa: b.summa,
              kirimBor: Boolean(b.transactionId),
            })),
          }}
          kategoriyalar={kategoriyaStat}
        />

        <CrmClient
          stages={stages}
          kategoriyalar={kategoriyalar}
          xodimlar={xodimlar}
          xodimKategoriyalari={xodimKategoriyalari.map((k) => ({
            id: k.id,
            nomi: k.nomi,
            turi: k.turi,
            azolar: k.azolar.map((a) => ({ id: a.id, ism: a.ism, userId: a.userId })),
          }))}
          sotuvchilar={sotuvchilar}
          ozimSotuvchi={ozim?.id ?? null}
          sotuvchiMajburiy={sotuvchiMajburiy}
          sotuvchiOzgartira={sotuvchiOzgartira}
          meId={session.userId}
          bugun={bugun}
          buyurtmalar={board.deals.map((d) => ({
            id: d.id,
            nomi: d.nomi,
            summa: d.summa,
            stageId: d.stageId,
            categoryId: d.categoryId,
            kategoriya: d.category?.nomi ?? null,
            kontakt: d.contact?.ism ?? null,
            tel: d.contact?.tel ?? null,
            sana: d.sana ? utcDateToDateOnlyString(d.sana) : null,
            izoh: d.izoh,
            masulId: d.masulId,
            masulIsm: ismlar.get(d.masulId) ?? null,
            transactionId: d.transactionId,
            sotuvchi: board.sotuvchilar.get(d.id)
              ? {
                  employeeId: board.sotuvchilar.get(d.id)!.employeeId,
                  ism: board.sotuvchilar.get(d.id)!.ism,
                  isActive: board.sotuvchilar.get(d.id)!.isActive,
                }
              : null,
          }))}
        />
      </div>
    );
  });
}
