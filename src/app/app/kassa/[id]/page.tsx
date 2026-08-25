import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { hasPermission } from "@/lib/permissions/tekshir";
import { resolveActiveBusinessId } from "@/lib/business";
import { getKassaDetal } from "@/lib/queries/kassaDetal";
import { Money } from "@/components/ui/Money";
import { formatSom, formatToshkentVaqt } from "@/lib/format";
import { ACCOUNT_TURI_NOMI, type AccountTuri } from "@/lib/validation/account";
import { DAVR_YORLIQ, davrBoshi, davrOqi, oraliqChegaralari } from "@/lib/kassaDavr";
import { DavrFiltr } from "./DavrFiltr";
import { TransferRoyxat } from "./TransferRoyxat";

/** To'lov turi yorliqlari — bazadagi kalitlar UI matniga aylantiriladi. */
const TOLOV_NOMI: Record<string, string> = {
  naqd: "Naqd",
  click: "Click / karta",
  qarz: "Qarz",
};

/**
 * BITTA KASSA DETALI — qoldiq, davr kesimi va to'liq tarix.
 *
 * Sahifa "bu kassada nima bo'ldi" savoliga javob beradi: joriy qoldiq,
 * bugungi va tanlangan davrdagi kirim/chiqim, pulning qaysi yo'l bilan
 * kelgani (naqd/click), harakatlar lentasi hamda topshirishlar va
 * o'tkazmalar alohida ro'yxatlarda.
 *
 * Davr URL parametrida (`?davr=` yoki `?davr=oraliq&dan=&gacha=`) —
 * ro'yxat BAZADAN kesib olinadi va havola boshqa odamga yuborilsa ham AYNI
 * kesimni ochadi.
 *
 * Kassa boshqa biznesniki bo'lsa `getKassaDetal` uni umuman topmaydi
 * (so'rov aktiv `businessId` bilan cheklangan) — sahifa 404 qaytaradi.
 */
export default async function KassaDetalPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { davr?: string; dan?: string; gacha?: string };
}) {
  const { id } = params;
  const { session, tenantId } = await requireTenantPage();

  return runWithTenant(tenantId, async () => {
    if (!(await hasPermission(session.userId, "kassa.korish"))) {
      redirect("/app/tranzaksiyalar");
    }
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) notFound();

    const oraliq = oraliqChegaralari(searchParams?.dan, searchParams?.gacha);
    // Oraliq berilmagan yoki noto'g'ri bo'lsa — odatdagi davrga qaytamiz.
    const davr = oraliq ? "oraliq" : davrOqi(searchParams?.davr);
    const detal = await getKassaDetal(businessId, id, {
      limit: 60,
      boshlanish: oraliq ? oraliq.boshlanish : davrBoshi(davr),
      tugash: oraliq ? oraliq.tugash : null,
    });
    if (!detal) notFound();

    const { kassa } = detal;
    const davrNomi = oraliq ? `${searchParams?.dan} — ${searchParams?.gacha}` : DAVR_YORLIQ[davr];

    return (
      <div className="space-y-4 sm:space-y-5">
        <div>
          <Link href="/app/kassa" className="text-2xs text-muted hover:text-brand">
            ← Kassalar
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-fg mt-1 break-words">{kassa.nomi}</h1>
          <p className="text-2xs sm:text-sm text-muted mt-0.5">
            {kassa.userId
              ? `Shaxsiy kassa · mas'ul: ${kassa.egaIsm ?? "egasi o'chirilgan"}`
              : (ACCOUNT_TURI_NOMI[kassa.turi as AccountTuri] ?? kassa.turi)}
            {kassa.isActive ? "" : " · nofaol"}
          </p>
        </div>

        <section className="bg-surface border border-line rounded-2xl shadow-card p-4 sm:p-6">
          <p className="text-2xs font-medium uppercase tracking-wider text-faint">Joriy qoldiq</p>
          <div className="mt-1">
            <Money value={kassa.qoldiq} size="display" tone={kassa.qoldiq >= 0 ? "brand" : "expense"} />
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-line text-2xs">
            <Kesim yorliq="Bugungi kirim" qiymat={detal.bugungiKirim} rang="text-income" belgi="+" />
            <Kesim yorliq="Bugungi chiqim" qiymat={detal.bugungiChiqim} rang="text-expense" belgi="−" />
            <Kesim yorliq={`${davrNomi} kirim`} qiymat={detal.davrKirim} rang="text-income" belgi="+" />
            <Kesim yorliq={`${davrNomi} chiqim`} qiymat={detal.davrChiqim} rang="text-expense" belgi="−" />
          </dl>
          {detal.tolovKesimi.length > 0 && (
            <p className="mt-3 pt-3 border-t border-line text-2xs text-muted flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-faint">Kirim manbai:</span>
              {detal.tolovKesimi
                .filter((k) => k.kirim > 0)
                .map((k) => (
                  <span key={k.tur} className="whitespace-nowrap">
                    {TOLOV_NOMI[k.tur] ?? k.tur}{" "}
                    <span className="tnum font-medium text-fg">{formatSom(k.kirim)}</span>
                  </span>
                ))}
            </p>
          )}
          <p className="mt-3 text-2xs text-faint">
            Oxirgi topshirish:{" "}
            {detal.oxirgiTopshirish
              ? formatToshkentVaqt(new Date(detal.oxirgiTopshirish))
              : "hali topshirilmagan"}
          </p>
        </section>

        <DavrFiltr
          accountId={kassa.id}
          davr={davr}
          dan={searchParams?.dan ?? ""}
          gacha={searchParams?.gacha ?? ""}
        />

        <section className="bg-surface border border-line rounded-2xl shadow-card">
          <h2 className="px-4 sm:px-5 pt-4 pb-2 font-semibold text-fg">Kassa harakatlari</h2>
          {detal.harakatlar.length === 0 ? (
            <p className="px-4 sm:px-5 pb-4 text-2xs text-faint">
              {davrNomi} kesimida harakat yo&apos;q
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {detal.harakatlar.map((h) => (
                <li
                  key={`${h.turi}-${h.id}`}
                  className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-fg truncate">{h.matn}</p>
                    <p className="text-2xs text-faint mt-0.5">
                      {formatToshkentVaqt(new Date(h.vaqt))}
                    </p>
                  </div>
                  <p
                    className={`font-display tnum text-sm font-medium shrink-0 whitespace-nowrap ${
                      h.summa >= 0 ? "text-income" : "text-expense"
                    }`}
                  >
                    {h.summa >= 0 ? "+ " : "− "}
                    {formatSom(Math.abs(h.summa))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <TransferRoyxat
          sarlavha="Topshirishlar"
          qatorlar={detal.topshirishlar}
          bosh={`${davrNomi} kesimida topshirish yo'q`}
        />
        <TransferRoyxat
          sarlavha="O'tkazmalar"
          qatorlar={detal.otkazmalar}
          bosh={`${davrNomi} kesimida o'tkazma yo'q`}
        />

        <p className="text-2xs text-faint px-1">
          Kassa {kassa.userId ? `${kassa.egaIsm ?? "—"} nomiga ochilgan` : "umumiy"} · qoldiq
          ledgerdan hisoblanadi: kirim − chiqim + kirgan o&apos;tkazma − chiqqan
          o&apos;tkazma.
        </p>
      </div>
    );
  });
}

function Kesim({
  yorliq,
  qiymat,
  rang,
  belgi,
}: {
  yorliq: string;
  qiymat: number;
  rang: string;
  belgi: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted truncate">{yorliq}</dt>
      <dd className={`mt-0.5 font-display tnum text-base whitespace-nowrap ${rang}`}>
        {belgi} {formatSom(qiymat)}
      </dd>
    </div>
  );
}
