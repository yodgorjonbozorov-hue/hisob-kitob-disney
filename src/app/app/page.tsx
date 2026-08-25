import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { MonthSelector } from "@/components/MonthSelector";
import { TrendChart } from "@/components/charts/TrendChart";
import { DailyDynamicsChart } from "@/components/charts/DailyDynamicsChart";
import { formatMoneyCompact, formatSomLabel, formatMonthLabel, formatSom } from "@/lib/format";
import {
  currentMonthString,
  todayDateOnlyString,
  todayTashkentDateOnlyString,
  monthRangeUTC,
  utcDateToDateOnlyString,
  parseMonthString,
} from "@/lib/date";
import { cookies } from "next/headers";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
// Dashboard raqamlari 60 soniya keshlanadi; yozuv o'zgarganda kesh darhol
// bekor qilinadi (lib/cache.ts -> dashboardYangilandi).
import {
  getMonthSummaryKesh,
  getCategoryBreakdownKesh,
  getTrendKesh,
  getDailyDynamicsKesh,
  getQarzJamlariKesh,
  getTolovTaqsimotiKesh,
  getOmborKartasiKesh,
  getKassaHolatiKesh,
  getBugungiHolatKesh,
} from "@/lib/queries/dashboardCached";
import { getTodayTotals } from "@/lib/queries/shift";
import { listTransactions } from "@/lib/queries/transactions";
import { getProBugun } from "@/lib/queries/proDashboard";
import { getKgSavdo } from "@/lib/queries/selos";
import { bugunPaneliKorinadi, kgSavdoKorinadi } from "@/lib/mijozXos";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import type { OmborKartasiDTO } from "@/lib/queries/inventory";
import { KassaHome } from "./KassaHome";
import { KategoriyaBloki } from "./KategoriyaBloki";
import { PulOqimiKartalari } from "./PulOqimiKartalari";
import { YASHIRIN_COOKIE, yashirinniOqi } from "@/lib/pulYashirish";
import { SelosBugunKartasi } from "./SelosBugunKartasi";
import { BugungiHolatBloki } from "./BugungiHolatBloki";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const { session, tenantId, tenant } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {

  // Kassir/sotuvchi — dashboard EMAS, kassa bosh ekrani (REDESIGN.md 5.1).
  if (!isManager(session.rol)) {
    const bId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!bId) {
      return (
        <div className="max-w-lg mx-auto">
          <p className="text-muted">Sizga biznes biriktirilmagan. Admin bilan bog'laning.</p>
        </div>
      );
    }
    const today = todayDateOnlyString();
    // Kassir/sotuvchi ekrani — bugungi jami ham, lenta ham faqat o'z yozuvlaridan.
    const scopeUserId = transactionScopeUserId(session);
    const [bugun, recentRes] = await Promise.all([
      getTodayTotals(bId, today, scopeUserId),
      listTransactions({ businessId: bId, userId: scopeUserId, page: 1, pageSize: 12 }),
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
  // OMBOR KARTASI faqat ombor yuritadigan biznesda. Ombori yo'q biznesda
  // (masalan gul do'koni) karta ATAYLAB umuman ko'rsatilmaydi — "0 dona"
  // deb turish ekranni chalg'itardi. Bu qarz kartasidagi holatdan farq
  // qiladi: u yerda ma'lumot BOR edi, karta esa uni yashirardi.
  const business = await getActiveBusiness(session);
  const omborKorinadi =
    (business?.omborli ?? false) && (await isModuleOnForTenant(tenantId, "OMBOR"));
  // "Bugungi holat" CRM qatorlari faqat CRM yoqilgan biznesda so'raladi —
  // moduli yo'q mijozda so'rov ham ketmaydi, blok ham CRM'siz chiziladi.
  const crmKorinadi = await isModuleOnForTenant(tenantId, "CRM");
  const bugunStr = todayDateOnlyString();
  const [summary, kirimBreakdown, chiqimBreakdown, trend, daily, qarzTotal, kirimTaqsimot, chiqimTaqsimot, ombor, categoryCount, proBugun, kgBugun, kassaHolati, bugungiHolat] = await Promise.all([
    getMonthSummaryKesh(businessId, month),
    getCategoryBreakdownKesh(businessId, month, "kirim"),
    getCategoryBreakdownKesh(businessId, month, "chiqim"),
    getTrendKesh(businessId, 6, month),
    getDailyDynamicsKesh(businessId, month),
    // QARZ OMBORDAN MUSTAQIL. Ilgari bu so'rov `business.omborli` bilan
    // o'ralgan edi va ombori yo'q biznesda karta har doim 0 ko'rsatardi —
    // qarzlar bazada turgan holda. Qarzlar sahifasidan ombor sharti
    // olib tashlanganda bu joy e'tibordan qolib ketgan.
    getQarzJamlariKesh(businessId),
    getTolovTaqsimotiKesh(businessId, month, "kirim"),
    getTolovTaqsimotiKesh(businessId, month, "chiqim"),
    omborKorinadi ? getOmborKartasiKesh(businessId) : Promise.resolve(null),
    prisma.category.count({ where: { businessId } }),
    // Bugungi kg va kassa/jamoa ko'rsatkichlari (mijozga xos blok).
    bugunPanel ? getProBugun(businessId) : Promise.resolve(null),
    // Bugungi kg savdosi (yozuvlardan): jami kg, tushum va sotuvchilar kesimi.
    kgPanel ? getKgSavdo(businessId, todayTashkentDateOnlyString()) : Promise.resolve(null),
    // "Kassadagi pul" kartasi — FAOL kassalardagi joriy qoldiq. Bu oy
    // ko'rsatkichi EMAS: butun davr bo'yicha kirim − chiqim ± o'tkazmalar.
    getKassaHolatiKesh(businessId),
    getBugungiHolatKesh(businessId, bugunStr, crmKorinadi),
  ]);

  // Kategoriya tafsiloti uchun oy oralig'i, "YYYY-MM-DD" (ikkala chet kiradi).
  // `monthRangeUTC.to` — keyingi oy boshi, shuning uchun bir kun ayiriladi.
  const { from: oyBosh, to: oyKeyingi } = monthRangeUTC(month);
  const oyFrom = utcDateToDateOnlyString(oyBosh);
  const oyTo = utcDateToDateOnlyString(new Date(oyKeyingi.getTime() - 24 * 60 * 60 * 1000));
  const { year: oyYil, monthIndex0: oyIndeks } = parseMonthString(month);
  const oyNomi = formatMonthLabel(oyYil, oyIndeks);

  // Pul kartalarining "ko'z" holati COOKIE'da. Serverda o'qilishi shart:
  // aks holda summa avval ko'rinib, keyin yashirilardi.
  const yashirin = yashirinniOqi((await cookies()).get(YASHIRIN_COOKIE)?.value);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Boshqaruv paneli</h1>
        <MonthSelector month={month} />
      </div>

      {categoryCount === 0 && (
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

      {/* KPI QATORI: Jami kirim · Jami chiqim · Sof foyda · Kassadagi pul ·
          Menga qarzdor (+ ombor yuritadigan biznesda 6-karta).

          Uchta birinchi karta TANLANGAN OY ko'rsatkichlari, "Kassadagi pul"
          va "Menga qarzdor" esa JORIY holat (butun davr). Ular ataylab shu
          qatorda: biznes egasining birinchi savoli "hozir qancha pulim bor?"
          va u javobni oy tanlashdan oldin ko'rishi kerak. Farq karta ichidagi
          izohda yozilgan, shuning uchun raqamlar chalkashmaydi. */}
      {/* Bir qatorga 5-6 karta faqat JUDA keng ekranda sig'adi: 1440px'da
          ular ~180px ga siqilib, "125 ming" ikki qatorga tushib ketardi.
          Shuning uchun 2xl'gacha 3 ustun (5 karta -> 3+2, 6 karta -> 3+3). */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-3 ${
          ombor ? "2xl:grid-cols-6" : "2xl:grid-cols-5"
        }`}
      >
        {/* Kirim va chiqim kartalari bosiladi — to'lov turlari bo'yicha
            taqsimot ochiladi. Taqsimot serverda, karta bilan BITTA oy
            oralig'ida hisoblanadi: yig'indisi kartadagi raqamga teng
            bo'lishi shart. Uchala kartada ko'z tugmasi bor (summani
            yashirish), shuning uchun "Sof foyda" ham shu komponentda. */}
        <PulOqimiKartalari
          kirimSumma={summary.jamiKirim}
          chiqimSumma={summary.jamiChiqim}
          sofFoyda={summary.sofFoyda}
          kirimChangePct={summary.changePct.kirim}
          chiqimChangePct={summary.changePct.chiqim}
          foydaChangePct={summary.changePct.sofFoyda}
          kirimTaqsimot={kirimTaqsimot}
          chiqimTaqsimot={chiqimTaqsimot}
          oyFrom={oyFrom}
          oyTo={oyTo}
          oyNomi={oyNomi}
          yashirinBoshlangich={yashirin}
        />
        {/* KASSADAGI PUL — barcha FAOL kassalardagi real joriy qoldiq
            (lib/queries/accounts.ts -> getKassaHolati). Kirim bilan
            adashtirilmaydi: bu davr summasi emas, ayni paytdagi qoldiq. */}
        <StatCard
          label="Kassadagi pul"
          value={formatMoneyCompact(kassaHolati.faolJami)}
          title={formatSomLabel(kassaHolati.faolJami)}
          accent={kassaHolati.faolJami >= 0 ? "brand" : "expense"}
          href="/app/kassa"
        >
          <p className="text-2xs mt-1 tnum text-muted">
            {kassaHolati.faolSoni} ta faol kassa · joriy qoldiq
          </p>
          {/* Nofaol kassada qolib ketgan pul YASHIRILMAYDI, lekin asosiy
              raqamga ham qo'shilmaydi (u "joriy kassa" emas). */}
          {kassaHolati.nofaolJami !== 0 && (
            <p className="text-2xs mt-0.5 tnum text-muted">
              Nofaol kassalarda: {formatMoneyCompact(kassaHolati.nofaolJami)}
            </p>
          )}
        </StatCard>

        {/* Yagona bosiladigan karta — qarzdorlar ro'yxatiga olib kiradi.
            Raqam har yuklashda yozuvlardan qayta hisoblanadi (qo'lda
            yuritiladigan "joriy balans" ustuni yo'q). */}
        <StatCard
          label="Menga qarzdor"
          value={formatMoneyCompact(qarzTotal.olinadigan)}
          title={formatSomLabel(qarzTotal.olinadigan)}
          accent={qarzTotal.olinadigan > 0 ? "debt" : "neutral"}
          href="/app/qarzlar?turi=olinadigan"
          /* Ombor kartasi yo'q bo'lsa bu — 5-karta va telefondagi 2 ustunli
             tarmoqda yakka qoladi; shu holda ikkala ustunni egallaydi. */
          className={ombor ? "" : "col-span-2 sm:col-span-1"}
        >
          <p className="text-2xs mt-1 tnum text-muted">
            {qarzTotal.olinadiganSoni} ta qarzdor
          </p>
          {qarzTotal.beriladigan > 0 && (
            <p className="text-2xs mt-0.5 tnum text-muted">
              Men qarzdorman:{" "}
              <span className="font-medium text-expense">
                {formatMoneyCompact(qarzTotal.beriladigan)}
              </span>{" "}
              · {qarzTotal.beriladiganSoni} ta
            </p>
          )}
        </StatCard>

        {/* 6-KARTA — faqat ombor yuritadigan biznesda. U "Menga qarzdor"
            bilan juftlashadi, shuning uchun ustun cho'zish kerak emas. */}
        {ombor && (
          <StatCard
            label="Ombordagi mahsulotlar"
            value={omborQiymat(ombor)}
            accent="brand"
            href="/app/ombor"
          >
            {/* Boshqa birliklar ALOHIDA qatorda: "500 dona + 120 kg" ni
                bitta raqamga qo'shish matematik jihatdan noto'g'ri. */}
            <p className="text-2xs mt-1 tnum text-muted truncate">
              {ombor.turlarSoni} ta tur
              {ombor.birliklar.length > 1 &&
                ` · ${ombor.birliklar
                  .slice(1)
                  .map((b) => `${formatSom(b.miqdor)} ${b.birlik}`)
                  .join(" · ")}`}
            </p>
            {/* QIYMAT — miqdordan farqli o'laroq pul birliklar bo'ylab
                qo'shilaveradi, shuning uchun bitta raqam. */}
            <p
              className="text-2xs mt-0.5 tnum text-brand font-medium"
              title={formatSomLabel(ombor.jamiQiymat)}
            >
              Qiymati: {formatMoneyCompact(ombor.jamiQiymat)} so&apos;m
            </p>
          </StatCard>
        )}
      </div>

      {/* BUGUNGI HOLAT — kunlik kesim (KPI kartalari oy bo'yicha).
          `proBugun` bloki ochiq mijozda (Fortex Selos) chizilmaydi: u yerda
          shu raqamlarni kg ko'rsatkichlari bilan birga beradigan o'z "Bugun"
          paneli bor va ikkalasi yonma-yon turganda takrorlanardi. */}
      {!proBugun && <BugungiHolatBloki holat={bugungiHolat} />}

      {/* Kg savdosi (mijozga xos — Fortex Selos): bugun necha kg, qancha tushum,
          sotuvchilar bo'yicha. Boshqa mijozlarda bu blok umuman yo'q. */}
      {kgBugun && <SelosBugunKartasi hisobot={kgBugun} />}

      {proBugun && (
        <Card>
          <h2 className="font-semibold text-fg mb-3">Bugun</h2>
          {/* Kirim/chiqim va kg — BUGUNGI kun; kassa va qarz — JORIY holat. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
            <div>
              <p className="text-2xs text-muted">Kirim</p>
              <p className="font-semibold tnum text-income">{formatMoneyCompact(proBugun.kirim)}</p>
            </div>
            <div>
              <p className="text-2xs text-muted">Chiqim</p>
              <p className="font-semibold tnum text-expense">{formatMoneyCompact(proBugun.chiqim)}</p>
            </div>
            <div>
              <p className="text-2xs text-muted">Sotilgan</p>
              <p className="font-semibold tnum text-fg">{proBugun.sotilganKg.toLocaleString("uz-UZ")} kg</p>
            </div>
            <div>
              <p className="text-2xs text-muted">Sotib olingan</p>
              <p className="font-semibold tnum text-fg">{proBugun.olinganKg.toLocaleString("uz-UZ")} kg</p>
            </div>
            <div>
              <p className="text-2xs text-muted">Qarz (sof)</p>
              <p className="font-semibold tnum text-fg">{formatMoneyCompact(proBugun.qarzSof)}</p>
              {proBugun.qarzBeriladigan > 0 && (
                <p className="text-2xs text-muted tnum">
                  beriladigan: {formatMoneyCompact(proBugun.qarzBeriladigan)}
                </p>
              )}
            </div>
            <div>
              <p className="text-2xs text-muted">Kassalar jami</p>
              <p className="font-semibold tnum text-fg">{formatMoneyCompact(proBugun.kassaJami)}</p>
            </div>
            <div>
              <p className="text-2xs text-muted">Foydalanuvchilar</p>
              <p className="font-semibold tnum text-fg">{proBugun.faolUserlar}</p>
              <p className="text-2xs text-muted tnum">ta&apos;minotchi: {proBugun.taminotchilar}</p>
            </div>
          </div>
        </Card>
      )}

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

      <Card>
        <h2 className="font-semibold text-fg mb-3">So'nggi 6 oy dinamikasi</h2>
        <TrendChart data={trend} />
      </Card>

      <Card>
        <h2 className="font-semibold text-fg mb-3">Kunlik dinamika (joriy oy)</h2>
        <DailyDynamicsChart data={daily} />
      </Card>
    </div>
  );
  });
}

/**
 * Kartadagi katta raqam — ENG KO'P mahsulot turiga ega birlikdan.
 * Qolgan birliklar karta ichida alohida qatorda ko'rsatiladi.
 */
function omborQiymat(o: OmborKartasiDTO): string {
  if (!o.asosiy) return "0";
  return `${formatSom(o.asosiy.miqdor)} ${o.asosiy.birlik}`;
}
