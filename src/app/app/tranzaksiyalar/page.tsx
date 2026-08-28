import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getAccessibleBusinesses, getActiveBusiness } from "@/lib/business";
import { isManager } from "@/lib/auth/roles";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { listTransactions, listKategoriyaJamlari } from "@/lib/queries/transactions";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getTezKategoriyalar } from "@/lib/queries/tezKategoriyalar";
import { isTolovGuruhi, type TolovGuruhi } from "@/lib/tolovBolimi";
import { formatSom } from "@/lib/format";
import { todayTashkentDateOnlyString } from "@/lib/date";
import { isModuleOnForTenant } from "@/lib/modules/guard";
import { TransactionsClient } from "./TransactionsClient";
import { listAccounts, getMeningKassam } from "@/lib/queries/accounts";
import { toshkentBugunBoshi } from "@/lib/services/kassirKassa";
import { KassamKartasi } from "@/components/kassa/KassamKartasi";
import { SotilganMahsulotlar } from "./SotilganMahsulotlar";
import { getSotuvStatistika, type SotuvStatistikaDTO } from "@/lib/queries/sotuvStatistika";

interface SearchParams {
  from?: string;
  to?: string;
  turi?: string;
  /** To'lov guruhi: naqd | click | karta | qarz. */
  tolov?: string;
  categoryId?: string;
  /** "Kim kiritdi" filtri — xodim uchun so'rovda kelsa ham e'tiborga olinmaydi. */
  xodimId?: string;
  q?: string;
  minSumma?: string;
  maxSumma?: string;
  page?: string;
}

/**
 * Bir sahifada 50 ta yozuv. Ilgari 20 edi — telefonda "Keyingi" ni juda
 * tez-tez bosishga to'g'ri kelardi; 999 ta yozuvni birdan yuklash esa
 * brauzerni qotirardi. Filtr, qidiruv va JAMILAR baribir SERVERDA, butun
 * to'plam bo'yicha hisoblanadi — sahifadagi 50 ta yozuv bo'yicha emas.
 */
const SAHIFA_HAJMI = 50;

export default async function TranzaksiyalarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  const businessId = await resolveActiveBusinessId(session);
  if (!businessId) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-fg">Kirim va chiqimlar</h1>
        <p className="text-muted">Sizga biznes biriktirilmagan. Admin bilan bog'laning.</p>
      </div>
    );
  }

  const scopeUserId = transactionScopeUserId(session);

  // FILTR BITTA JOYDA quriladi: ro'yxat ham, kategoriya kesimi ham AYNI
  // shartdan yuradi. Aks holda kategoriya kartasidagi summa bir davrni,
  // ichkaridagi yozuvlar boshqa davrni ko'rsatib qolishi mumkin edi.
  const filtr = {
    businessId,
    // Xodim faqat o'zi kiritgan yozuvlarni ko'radi, direktor — barchasini.
    userId: scopeUserId,
    from: searchParams.from,
    to: searchParams.to,
    turi: searchParams.turi,
    tolov: isTolovGuruhi(searchParams.tolov) ? (searchParams.tolov as TolovGuruhi) : null,
    categoryId: searchParams.categoryId,
    xodimId: searchParams.xodimId,
    q: searchParams.q,
    minSumma: searchParams.minSumma ? parseInt(searchParams.minSumma, 10) : null,
    maxSumma: searchParams.maxSumma ? parseInt(searchParams.maxSumma, 10) : null,
  };

  const [result, kategoriyaJamlari, jamiKorish, categories, accounts, masullar, meningKassam, tezKategoriyalar] =
    await Promise.all([
    listTransactions({
      ...filtr,
      page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
      pageSize: SAHIFA_HAJMI,
    }),
    // Sahifaning ASOSIY ro'yxati: kategoriya → yozuvlar.
    listKategoriyaJamlari(filtr),
    // DAVR YAKUNI HUQUQI. Mavjud granular huquq ishlatiladi
    // (`lib/permissions`): OWNER/ADMIN da bor, kassir va sotuvchida yo'q,
    // maxsus rolga esa biznes egasi o'zi bera oladi. Yangi, parallel
    // ruxsat tizimi kiritilmaydi.
    hasPermission(session.userId, "hisobot.korish"),
    prisma.category.findMany({
      where: { businessId, isActive: true },
      orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
    }),
    // Faol kassalar — formada tanlash uchun (bitta bo'lsa qadam yashiriladi).
    listAccounts(businessId, true),
    // Qarzga mas'ul sotuvchi/operator tanlash uchun (bitta bo'lsa yashiriladi).
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, ism: true },
      orderBy: { ism: "asc" },
      take: 100,
    }),
    // MENING KASSAM: foydalanuvchining shaxsiy kassasi (ledgerdan). Yuqoridagi
    // Naqd/Click/Qarz/Sof raqamlariga hech qanday ta'siri yo'q.
    getMeningKassam(businessId, session.userId, toshkentBugunBoshi()),
    // Ko'p ishlatiladigan kategoriyalar — FAQAT formadagi tartib uchun.
    getTezKategoriyalar(businessId, scopeUserId),
  ]);

  // SOTILGAN MAHSULOTLAR (Kirim bo'limi) — ombor yuritadigan biznesda.
  //
  // Sotuvchiga ko'rsatilmaydi: Sotuv sahifasi ham unga yopiq (API'da
  // `forbidSeller`), shu bois bu yerda ham ko'rinmaydi.
  //
  // Birinchi ko'rinish "Bugun" — server sanasi (Toshkent) bo'yicha. Filtr
  // almashtirilganda klient /api/sales/statistika ga o'tadi va sahifa qayta
  // yuklanmaydi.
  const bugun = todayTashkentDateOnlyString();
  let sotuvStatistika: SotuvStatistikaDTO | null = null;
  if (session.rol !== "SELLER") {
    const [omborYoqiq, biznes] = await Promise.all([
      isModuleOnForTenant(tenantId, "OMBOR"),
      getActiveBusiness(session),
    ]);
    if (omborYoqiq && biznes?.omborli) {
      sotuvStatistika = await getSotuvStatistika(businessId, { from: bugun, to: bugun });
    }
  }

  // Ko'chirish maqsadlari — direktor uchun joriy bizneskan boshqa bizneslar.
  const canMove = isManager(session.rol);
  const moveTargets = canMove
    ? (await getAccessibleBusinesses(session))
        .filter((b) => b.id !== businessId)
        .map((b) => ({ id: b.id, nomi: b.nomi }))
    : [];

  return (
    <div className="space-y-6">
      {/* Sarlavha va birlamchi amallar (+ Kirim / − Chiqim) bitta qatorda —
          ular TransactionsClient ichida, chunki tugmalar forma holatini
          boshqaradi. */}
      <TransactionsClient
        initialItems={result.items}
        initialTotal={result.total}
        page={result.page}
        pageSize={result.pageSize}
        categories={categories}
        accounts={accounts}
        masullar={masullar}
        // "Kim kiritdi" filtri faqat direktorga: xodim baribir o'z
        // yozuvlarinigina ko'radi, ro'yxat unga faqat yolg'on tanlov berardi.
        xodimlar={canMove ? masullar : []}
        tezKategoriyalar={tezKategoriyalar}
        currentUserId={session.userId}
        currentUserRol={session.rol}
        moveTargets={moveTargets}
        // Huquq bo'lmasa raqamlar UMUMAN yuborilmaydi — CSS bilan
        // yashirish emas, HTMLda ham yo'q.
        totals={jamiKorish ? result.totals : null}
        kategoriyaJamlari={kategoriyaJamlari}
        filters={{
          from: searchParams.from ?? "",
          to: searchParams.to ?? "",
          turi: searchParams.turi ?? "",
          tolov: searchParams.tolov ?? "",
          categoryId: searchParams.categoryId ?? "",
          xodimId: searchParams.xodimId ?? "",
          q: searchParams.q ?? "",
          minSumma: searchParams.minSumma ? formatSom(parseInt(searchParams.minSumma, 10)) : "",
          maxSumma: searchParams.maxSumma ? formatSom(parseInt(searchParams.maxSumma, 10)) : "",
        }}
      />
      {/* OMBOR → SOTUV → STATISTIKA. Blok tranzaksiya ro'yxatidan keyin
          turadi: u kirimning MAHSULOT KESIMI, ya'ni pul yozuvlarining
          tafsiloti — ularning o'rnini bosmaydi. */}
      {sotuvStatistika && (
        <SotilganMahsulotlar bugun={bugun} initial={sotuvStatistika} />
      )}
      {/* Asosiy moliyaviy blokdan ALOHIDA karta — kassirning real kassasi. */}
      <KassamKartasi kassa={meningKassam} />
    </div>
  );
  });
}
