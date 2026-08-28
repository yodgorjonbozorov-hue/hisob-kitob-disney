import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { MonthSelector } from "@/components/MonthSelector";
import { formatMonthLabel } from "@/lib/format";
import {
  currentMonthString,
  todayTashkentDateOnlyString,
  monthRangeUTC,
  utcDateToDateOnlyString,
  parseMonthString,
} from "@/lib/date";
import { cookies } from "next/headers";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
// Dashboard raqamlari 60 soniya keshlanadi; yozuv o'zgarganda kesh darhol
// bekor qilinadi (lib/cache.ts -> dashboardYangilandi).
import {
  getMonthSummaryKesh,
  getCategoryBreakdownKesh,
  getQarzJamlariKesh,
  getTolovTaqsimotiKesh,
  getKassaXulosaKesh,
  getPulOqimiKesh,
  getBugungiHolatKesh,
  getDiqqatAlertlariKesh,
} from "@/lib/queries/dashboardCached";
import { getProBugun } from "@/lib/queries/proDashboard";
import { getKgSavdo } from "@/lib/queries/selos";
import { bugunPaneliKorinadi, kgSavdoKorinadi } from "@/lib/mijozXos";
import { getEnabledModules } from "@/lib/modules/guard";
import { modulByCode } from "@/lib/modules/registry";
import { userHuquqlari } from "@/lib/permissions/tekshir";
import { insightlarniHisobla } from "@/lib/services/dashboardInsight";
import { XodimEkrani } from "./XodimEkrani";
import { ProBugunKartasi } from "./ProBugunKartasi";
import { KategoriyaBloki } from "./KategoriyaBloki";
import { PulOqimiKartalari } from "./PulOqimiKartalari";
import { PulOqimiBloki } from "./PulOqimiBloki";
import { InsightBloki } from "./InsightBloki";
import { BugungiHolat } from "./BugungiHolat";
import { DiqqatBloki } from "./DiqqatBloki";
import { YangiTugma, type YangiAmal } from "./YangiTugma";
import { YASHIRIN_COOKIE, yashirinniOqi } from "@/lib/pulYashirish";
import { SelosBugunKartasi } from "./SelosBugunKartasi";
import { biznesProfil, onboardingQadamlar } from "@/lib/pricing/profil";
import { OnboardingKarta, type OnboardingQadamKorinish } from "./OnboardingKarta";

/**
 * KPI tarmog'i — kartalar soniga qarab (huquqlar hammada bir xil emas).
 *
 * 5 karta faqat `xl` dan boshlab bitta qatorga chiqadi: 1280px dan tor
 * ekranda ular shunchalik siqilardiki, "78,3 mln" ikki qatorga bo'linib
 * ketardi. Oraliqda 3 ustun — 3 + 2 joylashuv.
 */
const KPI_TARMOQ: Record<number, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-3 xl:grid-cols-5",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId, tenant } = ctx;
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {

  // Kassir/sotuvchi — dashboard EMAS, kassa bosh ekrani (REDESIGN.md 5.1).
  // JSX (`<XodimEkrani/>`) EMAS, to'g'ridan-to'g'ri chaqiruv: JSX qilinsa React
  // uni `runWithTenant` tugagach render qiladi va ichidagi prisma so'rovlari
  // tenant kontekstsiz qolib "Tenant konteksti yo'q" bilan yiqiladi.
  if (!isManager(session.rol)) {
    return await XodimEkrani({ session });
  }

  const businessId = await resolveActiveBusinessId(session);
  const month = searchParams.month ?? currentMonthString();

  if (!businessId) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Boshqaruv paneli</h1>
        <p className="text-muted">Hali biznes yaratilmagan. Admin panel → Bizneslar bo'limidan qo'shing.</p>
      </div>
    );
  }

  // "Bugun" bloki — mijozga xos (Fortex Selos), tarif imkoniyati EMAS.
  // Boshqa mijozlarning dashboard'i o'zgarmaydi.
  const bugunPanel = bugunPaneliKorinadi(tenant);
  // Kg savdosi bloki — mijozga xos (Fortex Selos), tarif imkoniyati EMAS.
  const kgPanel = kgSavdoKorinadi(tenant);

  // ---------------------------------------------------------------------
  // ADAPTIV PANEL — nima ko'rinishi MODUL + ROL + HUQUQ dan chiqadi.
  //
  // Biznes NOMI bo'yicha shart yo'q: har bir blok o'zi tayanadigan
  // modulning yoqilganini va foydalanuvchining huquqini tekshiradi.
  // `getEnabledModules` layout'da ham chaqirilgan — `requestCache` uni
  // bitta DB so'roviga birlashtiradi.
  // ---------------------------------------------------------------------
  const business = await getActiveBusiness(session);
  const [yoqilganModullar, huquqlar] = await Promise.all([
    getEnabledModules(ctx),
    userHuquqlari(session.userId),
  ]);

  /** Modul tenantda yoqiqmi VA shu rolga ochiqmi. */
  const modulOchiq = (kod: string) =>
    yoqilganModullar.has(kod) && (modulByCode(kod)?.rollar.includes(session.rol) ?? false);

  const kassaKorinadi = huquqlar.has("kassa.korish");
  const qarzKorinadi = huquqlar.has("qarz.korish");
  // OMBOR ikki shartli: modul tenantda yoqiq VA biznes ombor yuritadi.
  // Ombori yo'q bizneste (masalan gul do'koni) ombor holati ATAYLAB
  // umuman ko'rsatilmaydi — "0 dona" deb turish ekranni chalg'itardi.
  const omborKorinadi =
    (business?.omborli ?? false) && modulOchiq("OMBOR") && huquqlar.has("ombor.korish");
  const crmOchiq = modulOchiq("CRM");
  const vazifalarOchiq = modulOchiq("VAZIFALAR");
  const aiOchiq = modulOchiq("AI");

  // Grafik va "bugungi holat" tanlangan oy kontekstida ishlaydi: joriy oyda
  // bugun, o'tgan oyda — o'sha oyning oxirgi kuni. Aks holda avgustni
  // ochib turib iyul grafigini ko'rish mumkin bo'lmasdi.
  const bugunStr = todayTashkentDateOnlyString();
  const { to: oyKeyingi } = monthRangeUTC(month);
  const oySongi = utcDateToDateOnlyString(new Date(oyKeyingi.getTime() - 24 * 60 * 60 * 1000));
  const oqimOxiri = oySongi < bugunStr ? oySongi : bugunStr;

  const [
    summary,
    kirimBreakdown,
    chiqimBreakdown,
    qarzTotal,
    kirimTaqsimot,
    chiqimTaqsimot,
    kassa,
    oqim,
    bugungi,
    alertlar,
    categoryCount,
    proBugun,
    kgBugun,
  ] = await Promise.all([
    getMonthSummaryKesh(businessId, month),
    getCategoryBreakdownKesh(businessId, month, "kirim"),
    getCategoryBreakdownKesh(businessId, month, "chiqim"),
    // QARZ OMBORDAN MUSTAQIL. Ilgari bu so'rov `business.omborli` bilan
    // o'ralgan edi va ombori yo'q biznesda karta har doim 0 ko'rsatardi —
    // qarzlar bazada turgan holda.
    qarzKorinadi ? getQarzJamlariKesh(businessId) : Promise.resolve(null),
    getTolovTaqsimotiKesh(businessId, month, "kirim"),
    getTolovTaqsimotiKesh(businessId, month, "chiqim"),
    kassaKorinadi ? getKassaXulosaKesh(businessId) : Promise.resolve(null),
    getPulOqimiKesh(businessId, oqimOxiri),
    getBugungiHolatKesh(businessId, bugunStr, { crm: crmOchiq, qarz: qarzKorinadi }),
    getDiqqatAlertlariKesh(businessId, bugunStr, {
      qarz: qarzKorinadi,
      kassa: kassaKorinadi,
      ombor: omborKorinadi,
      crm: crmOchiq,
      vazifalar: vazifalarOchiq,
    }),
    prisma.category.count({ where: { businessId } }),
    // Bugungi kg va kassa/jamoa ko'rsatkichlari (mijozga xos blok).
    bugunPanel ? getProBugun(businessId) : Promise.resolve(null),
    // Bugungi kg savdosi (yozuvlardan): jami kg, tushum va sotuvchilar kesimi.
    kgPanel ? getKgSavdo(businessId, bugunStr) : Promise.resolve(null),
  ]);

  // Xulosalar SHU YERDA hisoblanadi — qo'shimcha DB so'rovi yo'q, faqat
  // yuqoridagi natijalardan (deterministik, AI chaqiruvisiz).
  const insightlar = insightlarniHisobla({
    xulosa: summary,
    kirimKategoriyalar: kirimBreakdown,
    chiqimKategoriyalar: chiqimBreakdown,
    kassaJami: kassa?.jami ?? null,
    qarzOlinadigan: qarzTotal?.olinadigan ?? null,
  });

  // Kategoriya tafsiloti uchun oy oralig'i, "YYYY-MM-DD" (ikkala chet kiradi).
  const oyFrom = utcDateToDateOnlyString(monthRangeUTC(month).from);
  const oyTo = oySongi;
  const { year: oyYil, monthIndex0: oyIndeks } = parseMonthString(month);
  const oyNomi = formatMonthLabel(oyYil, oyIndeks);

  // Pul kartalarining "ko'z" holati COOKIE'da. Serverda o'qilishi shart:
  // aks holda summa avval ko'rinib, keyin yashirilardi.
  const yashirin = yashirinniOqi((await cookies()).get(YASHIRIN_COOKIE)?.value);

  // ---------------------------------------------------------------------
  // ONBOARDING (faqat sinov davri) — yo'nalishga moslashgan 3 qadam.
  // Bajarilganlik HAQIQIY ma'lumotdan (mahsulot/sotuv/mijoz soni) aniqlanadi;
  // hammasi bajarilgach karta yo'qoladi. Doimiy (ACTIVE) mijozlar uchun bu
  // blok umuman so'ralmaydi — dashboardga qo'shimcha yuk tushmaydi.
  // ---------------------------------------------------------------------
  let onboardingKorinish: OnboardingQadamKorinish[] = [];
  const onboardingQadamRoyxati =
    tenant.status === "TRIAL" && business
      ? onboardingQadamlar(business.yonalish, business.omborli)
      : [];
  if (onboardingQadamRoyxati.length > 0) {
    const kerak = new Set(onboardingQadamRoyxati.map((q) => q.kalit));
    const [mahsulotSoni, sotuvSoni, mijozSoni, buyurtmaSoni, tranzaksiyaSoni, xaridSoni] =
      await Promise.all([
        kerak.has("mahsulot") || kerak.has("import")
          ? prisma.product.count({ where: { businessId } })
          : Promise.resolve(0),
        kerak.has("sotuv") ? prisma.sale.count({ where: { businessId } }) : Promise.resolve(0),
        kerak.has("mijoz") ? prisma.contact.count({ where: { businessId } }) : Promise.resolve(0),
        kerak.has("buyurtma") ? prisma.deal.count({ where: { businessId } }) : Promise.resolve(0),
        kerak.has("tranzaksiya")
          ? prisma.transaction.count({ where: { businessId, deletedAt: null } })
          : Promise.resolve(0),
        kerak.has("xarid") ? prisma.stockEntry.count({ where: { businessId } }) : Promise.resolve(0),
      ]);
    const bajarildiMi = (kalit: (typeof onboardingQadamRoyxati)[number]["kalit"]): boolean => {
      switch (kalit) {
        case "mahsulot":
          return mahsulotSoni > 0;
        // Import — ko'p mahsulot birdan kirgani; qo'lda 10 tagacha kiritish
        // ham qadamning maqsadini (katalog to'ldirish) bajaradi.
        case "import":
          return mahsulotSoni >= 10;
        case "sotuv":
          return sotuvSoni > 0;
        case "mijoz":
          return mijozSoni > 0;
        case "buyurtma":
          return buyurtmaSoni > 0;
        case "tranzaksiya":
          return tranzaksiyaSoni > 0;
        case "xarid":
          return xaridSoni > 0;
      }
    };
    onboardingKorinish = onboardingQadamRoyxati.map((q) => ({
      label: q.label,
      href: q.href,
      bajarildi: bajarildiMi(q.kalit),
    }));
    // Hamma qadam bajarilgan — biznes yurib ketdi, karta endi kerak emas.
    if (onboardingKorinish.every((q) => q.bajarildi)) onboardingKorinish = [];
  }

  // "+ Yangi" menyusi — faqat foydalanuvchiga ochiq amallar.
  const yangiAmallar: YangiAmal[] = [];
  if (huquqlar.has("tranzaksiya.yaratish")) {
    yangiAmallar.push({ kod: "kirim", label: "Kirim" });
    yangiAmallar.push({ kod: "chiqim", label: "Chiqim" });
  }
  if (crmOchiq) yangiAmallar.push({ kod: "buyurtma", label: "Buyurtma", href: "/app/crm?yangi=1" });
  if (qarzKorinadi) {
    yangiAmallar.push({ kod: "qarz", label: "Qarz", href: "/app/qarzlar?turi=olinadigan&yangi=1" });
  }
  if (vazifalarOchiq) {
    yangiAmallar.push({ kod: "vazifa", label: "Vazifa", href: "/app/vazifalar?yangi=1" });
  }

  const kpiSoni = 3 + (kassa ? 1 : 0) + (qarzTotal ? 1 : 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Boshqaruv paneli</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <MonthSelector month={month} />
          <YangiTugma amallar={yangiAmallar} />
        </div>
      </div>

      {onboardingKorinish.length > 0 && business && (
        <OnboardingKarta
          biznesNomi={business.nomi}
          yonalishLabel={biznesProfil(business.yonalish)?.label ?? null}
          kunQoldi={ctx.access.kunQoldi}
          qadamlar={onboardingKorinish}
        />
      )}

      {categoryCount === 0 && onboardingKorinish.length === 0 && (
        <Card className="border-brand/40 bg-income-soft/30">
          <h2 className="font-semibold text-fg mb-1">Boshlashga tayyormisiz? 🚀</h2>
          <p className="text-sm text-muted mb-3">
            Bu biznes hali bo'sh. Ikki qadamda ishni boshlang:
          </p>
          <ol className="text-sm text-fg space-y-2">
            <li>
              1.{" "}
              <Link href="/app/admin/kategoriyalar" className="text-brand font-medium hover:underline">
                Kategoriya qo'shing
              </Link>{" "}
              (masalan: Sotuv, Ijara, Oylik)
            </li>
            <li>
              2.{" "}
              <Link href="/app/tranzaksiyalar" className="text-brand font-medium hover:underline">
                Birinchi tranzaksiyani kiriting
              </Link>
            </li>
          </ol>
        </Card>
      )}

      {/* KPI KARTALARI. Kirim/chiqim/foyda — TANLANGAN OY; kassa va qarz —
          JORIY holat (izoh `PulOqimiKartalari` da). */}
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${KPI_TARMOQ[kpiSoni] ?? "lg:grid-cols-5"}`}>
        <PulOqimiKartalari
          kirimSumma={summary.jamiKirim}
          chiqimSumma={summary.jamiChiqim}
          sofFoyda={summary.sofFoyda}
          kirimChangePct={summary.changePct.kirim}
          chiqimChangePct={summary.changePct.chiqim}
          foydaChangePct={summary.changePct.sofFoyda}
          kirimTaqsimot={kirimTaqsimot}
          chiqimTaqsimot={chiqimTaqsimot}
          kassa={kassa}
          qarz={qarzTotal}
          oyFrom={oyFrom}
          oyTo={oyTo}
          oyNomi={oyNomi}
          yashirinBoshlangich={yashirin}
        />
      </div>

      {/* Grafik va xulosa yonma-yon: "nima bo'ldi" va "bu nimani anglatadi"
          bitta qatorda. Telefonda ustma-ust tushadi. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 min-w-0">
          <PulOqimiBloki oqim={oqim} />
        </div>
        <InsightBloki insightlar={insightlar} aiHavolasi={aiOchiq} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BugungiHolat holat={bugungi} />
        <DiqqatBloki alertlar={alertlar} />
      </div>

      {/* Kg savdosi (mijozga xos — Fortex Selos): bugun necha kg, qancha tushum,
          sotuvchilar bo'yicha. Boshqa mijozlarda bu blok umuman yo'q. */}
      {kgBugun && <SelosBugunKartasi hisobot={kgBugun} />}

      {proBugun && <ProBugunKartasi bugun={proBugun} />}

      {/* Har kategoriya qatori bosiladi — o'sha kategoriyaning yozuvlari
          ochiladi. Oy oralig'i ham uzatiladi: oynadagi jami kartadagi
          summa bilan bir xil davrga tegishli bo'lishi shart. */}
      <KategoriyaBloki
        kirim={kirimBreakdown}
        chiqim={chiqimBreakdown}
        oyFrom={oyFrom}
        oyTo={oyTo}
        oyNomi={oyNomi}
      />
    </div>
  );
  });
}
