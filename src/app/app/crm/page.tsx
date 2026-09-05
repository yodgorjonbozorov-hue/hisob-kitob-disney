import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { prisma } from "@/lib/prisma";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { doskaSahifalari } from "@/lib/crm/service";
import { ustunSahifaDTO } from "@/lib/crm/dto";
import { ASOSIY_USTUNLAR, USTUNLAR, type Ustun } from "@/lib/crm/pipeline";
import { doskaFiltrSchema } from "@/lib/validation/crm";
import { biznesXodimlariWhere } from "@/lib/services/userBiznes";
import { crmFormaKategoriyalari } from "@/lib/services/xodimKategoriya";
import { sotuvchilarRoyxati, sotuvchiMajburiymi } from "@/lib/services/zakazSotuvchi";
import { hasPermission } from "@/lib/permissions/tekshir";
import { isManager } from "@/lib/auth/roles";
import { crmYuqoriPanel } from "@/lib/crm/yuqoriPanel";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { listAccounts } from "@/lib/queries/accounts";
import { todayTashkentDateOnlyString } from "@/lib/date";
import { CrmClient } from "./CrmClient";
import { YuqoriPanel } from "./YuqoriPanel";

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

    /*
     * DOSKA USTUNLARI ROLGA QARAB.
     *
     * Oddiy xodimda avvalgi to'rtta ustun qoladi — telefonda gorizontal
     * svayp shunga moslangan va "Yo'qotildi" kundalik ishda shovqin.
     * DIREKTOR/ADMINISTRATOR esa beshinchisini ham ko'radi: yo'qotilgan
     * zakaz o'chib ketmasligi kerak, u yerda sabab va sotuvchi turadi.
     * Ustun ro'yxati SERVERDA hisoblanadi — brauzerga faqat kerakli
     * sahifalar jo'natiladi.
     */
    const boshqaruvchi = isManager(session.rol);
    const ustunlar: Ustun[] = boshqaruvchi ? [...USTUNLAR] : [...ASOSIY_USTUNLAR];

    const [
      sahifalar,
      kategoriyalar,
      xodimlar,
      yuqoriPanel,
      chiqimKategoriyalari,
      kassalar,
      xodimKategoriyalari,
      sotuvchilar,
      sotuvchiMajburiy,
      jamoaHuquqi,
      bahoYozaOladi,
    ] = await Promise.all([
      // DOSKA — har ustunning BIRINCHI sahifasi (10 tadan). Qolgani
      // "Yana ko'rsatish" bilan server tomondan keladi: 500 ta zakazni
      // yuklab brauzerda yashirish YO'Q (mobil uchun ham yengil).
      doskaSahifalari(businessId, filtr, bugun, ustunlar),
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
      // YUQORI PANEL: xodimning O'Z kassasi + tez chiqim (lib/crm/yuqoriPanel.ts).
      crmYuqoriPanel(
        businessId,
        { userId: session.userId, ism: session.ism ?? "Xodim" },
        transactionScopeUserId(session),
        bugun
      ),
      // Tez chiqim formasi uchun CHIQIM kategoriyalari (yuqoridagi ro'yxat
      // kirim turida — u zakaz kategoriyasi uchun).
      prisma.category.findMany({
        where: { businessId, turi: "chiqim", isActive: true },
        select: { id: true, nomi: true },
        orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
      }),
      // Kassalar — faqat NOM (qoldiq olinmaydi: kassa maxfiyligi).
      listAccounts(businessId, true),
      // Xodim kategoriyalari (Sotuvchi/Diktor/...) — zakaz-xodim biriktiruvi.
      crmFormaKategoriyalari(businessId),
      // SOTUVCHI: shu biznesning BARCHA faol sotuvchilari (forma va filtr) —
      // kim kirgan bo'lsa ham bir xil ro'yxat, avto-tanlash yo'q.
      sotuvchilarRoyxati(businessId),
      sotuvchiMajburiymi(businessId),
      hasPermission(session.userId, "crm.jamoa"),
      hasPermission(session.userId, "crm.baho"),
    ]);

    const ismlar = new Map(xodimlar.map((x) => [x.id, x.ism]));

    // TEZ CHIQIM formasidagi kassa ro'yxati: xodimning O'Z kassasi BIRINCHI
    // (default tanlov) — chiqim odatda qo'ldagi naqddan qilinadi. Qoldiq
    // uzatilmaydi, faqat nom (kassa maxfiyligi).
    const chiqimKassalari = [...kassalar]
      .sort((a, b) => Number(b.userId === session.userId) - Number(a.userId === session.userId))
      .map((k) => ({ id: k.id, nomi: k.nomi }));

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">CRM — Buyurtmalar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Kunlik
            buyurtmalar va ularning Kirimga o&apos;tishi
          </p>
        </div>

        <YuqoriPanel
          boshlangich={yuqoriPanel}
          kategoriyalar={chiqimKategoriyalari}
          kassalar={chiqimKassalari}
          bugun={bugun}
        />

        <CrmClient
          ustunlar={ustunlar}
          boshqaruvchi={boshqaruvchi}
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
            kopXodim: k.kopXodim,
            azolar: k.azolar.map((a) => ({ id: a.id, ism: a.ism, userId: a.userId })),
          }))}
          sotuvchilar={sotuvchilar}
          sotuvchiMajburiy={sotuvchiMajburiy}
          jamoaHuquqi={jamoaHuquqi}
          bahoYozaOladi={bahoYozaOladi}
          meId={session.userId}
          bugun={bugun}
          sahifalar={sahifalar.map((x) => ustunSahifaDTO(x, ismlar))}
        />
      </div>
    );
  });
}
