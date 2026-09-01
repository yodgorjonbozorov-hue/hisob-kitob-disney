import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { prisma } from "@/lib/prisma";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getBoard } from "@/lib/crm/service";
import { tolovHolati, type TolovHolat } from "@/lib/crm/pipeline";
import { doskaFiltrSchema } from "@/lib/validation/crm";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import { crmFormaKategoriyalari } from "@/lib/services/xodimKategoriya";
import { avtoSotuvchi, sotuvchilarRoyxati, sotuvchiMajburiymi } from "@/lib/services/zakazSotuvchi";
import { hasPermission } from "@/lib/permissions/tekshir";
import { kunlikBuyurtmalar, kategoriyaStatistikasi } from "@/lib/crm/statistika";
import { todayTashkentDateOnlyString, utcDateToDateOnlyString } from "@/lib/date";
import { CrmClient } from "./CrmClient";
import { BugungiPanel } from "./BugungiPanel";

/**
 * CRM — ZAKAZ DOSKASI.
 *
 * Ustunlar: Kutilayotgan → Bugungi → Jarayonda → Yutildi (+ arxiv:
 * Yo'qotildi). Ustun BAZADA saqlanmaydi: u `Deal.holat` va `Deal.sana`
 * dan Toshkent kunini asos qilib hisoblanadi (`lib/crm/pipeline.ts`),
 * shuning uchun kun almashganda hech qanday cron ishlashi shart emas.
 */
export default async function CrmPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    masulId?: string;
    sotuvchiId?: string;
    categoryId?: string;
    tolov?: string;
  };
}) {
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

    // FILTR (12-talab) — URL'dan. Xato qiymat butun sahifani sindirmaydi:
    // tekshiruvdan o'tmagani jimgina e'tiborsiz qoladi (filtrsiz doska).
    const filtrParsed = doskaFiltrSchema.safeParse({
      from: searchParams.from ?? null,
      to: searchParams.to ?? null,
      masulId: searchParams.masulId ?? null,
      sotuvchiId: searchParams.sotuvchiId ?? null,
      categoryId: searchParams.categoryId ?? null,
      tolov: searchParams.tolov ?? null,
    });
    const filtr = filtrParsed.success ? filtrParsed.data : {};

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
      getBoard(businessId, filtr),
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
      // SOTUVCHI: faqat shu biznesning faol sotuvchilari (forma va filtr).
      sotuvchilarRoyxati(businessId),
      // Avto-tanlash — foydalanuvchining o'z sotuvchi profili.
      avtoSotuvchi(businessId, session.userId),
      sotuvchiMajburiymi(businessId),
      hasPermission(session.userId, "crm.sotuvchi"),
    ]);

    const ismlar = new Map(xodimlar.map((x) => [x.id, x.ism]));

    // TO'LOV HOLATI bazada ustun emas (summa va tolangan'dan hisoblanadi),
    // shuning uchun bu filtr o'qishdan keyin qo'llanadi.
    const zakazlar = filtr.tolov
      ? board.deals.filter((d) => tolovHolati(d.summa, d.tolangan) === (filtr.tolov as TolovHolat))
      : board.deals;

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
          kategoriyalar={kategoriyalar}
          xodimlar={xodimlar}
          filtr={{
            from: filtr.from ?? "",
            to: filtr.to ?? "",
            masulId: filtr.masulId ?? "",
            sotuvchiId: filtr.sotuvchiId ?? "",
            categoryId: filtr.categoryId ?? "",
            tolov: filtr.tolov ?? "",
          }}
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
          buyurtmalar={zakazlar.map((d) => ({
            id: d.id,
            nomi: d.nomi,
            summa: d.summa,
            tolangan: d.tolangan,
            tolovTuri: d.tolovTuri,
            holat: d.holat,
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
            debtId: d.debtId,
            // Kirim/qarz raqami YOZUVNING O'ZIDAN: o'chirilgan tranzaksiya
            // doskada eski summa bo'lib qolmasin.
            kirimSumma: d.transaction && !d.transaction.deletedAt ? d.transaction.summa : 0,
            qarzQoldiq: d.debt ? Math.max(0, d.debt.jamiSumma - d.debt.tolangan) : 0,
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
