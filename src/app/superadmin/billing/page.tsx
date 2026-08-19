import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r } from "@/lib/superadmin/rbac";
import { tolovlarRoyxati, billingXulosa } from "@/lib/superadmin/billing";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { formatSom, formatMoneyCompact, formatDate } from "@/lib/format";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Kpi, KpiSetka } from "@/components/superadmin/Kpi";
import { Filtrlar } from "@/components/superadmin/Filtrlar";
import { Jadval, type Ustun } from "@/components/superadmin/Jadval";
import { Sahifalash } from "@/components/superadmin/Sahifalash";
import { TolovStatus } from "@/components/superadmin/belgilar";
import { FiltrBoshHolat } from "@/components/superadmin/Holatlar";
import { Eksport } from "@/components/superadmin/Eksport";
import { TolovAmallar } from "@/components/superadmin/TolovAmallar";

export const dynamic = "force-dynamic";

interface Qator {
  id: string;
  tenantId: string;
  tenantNomi: string;
  amount: number;
  provider: string;
  status: string;
  plan: string | null;
  externalId: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

/** BILLING — to'lovlar, tushum va muammoli to'lovlar (talab 20). */
export default async function BillingSahifasi({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await requireSuperadminRuxsat(r("billing", "VIEW"));
  const p = new URLSearchParams(
    Object.entries(searchParams).filter((e): e is [string, string] => e[1] !== undefined)
  );

  const [natija, xulosa] = await Promise.all([
    tolovlarRoyxati(
      {
        qidiruv: searchParams.qidiruv ?? null,
        status: searchParams.status ?? null,
        provider: searchParams.provider ?? null,
      },
      sahifaParametrlari(p)
    ),
    billingXulosa(),
  ]);

  const osish =
    xulosa.otganOyTushum > 0
      ? Math.round(((xulosa.buOyTushum - xulosa.otganOyTushum) / xulosa.otganOyTushum) * 100)
      : null;

  const qaror = can(session.superRol, "billing", "UPDATE");

  const ustunlar: Ustun<Qator>[] = [
    { kalit: "tenant", sarlavha: "Kompaniya", katak: (q) => q.tenantNomi },
    { kalit: "summa", sarlavha: "Summa", raqam: true, katak: (q) => formatSom(q.amount) },
    { kalit: "provider", sarlavha: "Provayder", katak: (q) => q.provider },
    { kalit: "status", sarlavha: "Holat", katak: (q) => <TolovStatus status={q.status} /> },
    { kalit: "tarif", sarlavha: "Tarif", katak: (q) => q.plan ?? "—", ikkinchiDarajali: true },
    {
      kalit: "tashqi",
      sarlavha: "Tashqi ID",
      katak: (q) => <span className="font-mono text-2xs">{q.externalId ?? "—"}</span>,
      ikkinchiDarajali: true,
    },
    { kalit: "sana", sarlavha: "Yaratilgan", katak: (q) => formatDate(new Date(q.createdAt)) },
    {
      kalit: "tolangan",
      sarlavha: "To'langan",
      katak: (q) => (q.paidAt ? formatDate(new Date(q.paidAt)) : "—"),
      ikkinchiDarajali: true,
    },
    ...(qaror
      ? [
          {
            kalit: "amallar",
            sarlavha: "Amallar",
            katak: (q: Qator) => (
              <TolovAmallar
                paymentId={q.id}
                tenantNomi={q.tenantNomi}
                amount={q.amount}
                status={q.status}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <SahifaSarlavha
        sarlavha="Billing"
        izoh="To'lovlar, tushum va tasdiq kutayotgan qarorlar"
        amallar={can(session.superRol, "eksport", "VIEW") ? <Eksport turi="billing" /> : null}
      />

      <KpiSetka>
        <Kpi label="Jami tushum" qiymat={`${formatMoneyCompact(xulosa.jamiTushum)} so'm`} ton="muvaffaqiyat" />
        <Kpi
          label="Bu oy"
          qiymat={`${formatMoneyCompact(xulosa.buOyTushum)} so'm`}
          izoh={osish === null ? "o'tgan oy nolga teng" : `o'tgan oyga nisbatan ${osish > 0 ? "+" : ""}${osish}%`}
          ton={osish !== null && osish < 0 ? "ogoh" : "neytral"}
        />
        <Kpi label="MRR" qiymat={`${formatMoneyCompact(xulosa.mrr)} so'm`} />
        <Kpi
          label="Tasdiq kutmoqda"
          qiymat={String(xulosa.kutilayotganSoni)}
          izoh={`${formatMoneyCompact(xulosa.kutilayotganSumma)} so'm`}
          ton={xulosa.kutilayotganSoni > 0 ? "ogoh" : "neytral"}
          href="/superadmin/billing?status=PENDING"
        />
        <Kpi label="Rad etilgan" qiymat={String(xulosa.radEtilganSoni)} ton={xulosa.radEtilganSoni > 0 ? "xavf" : "neytral"} />
      </KpiSetka>

      <Bolim sarlavha="Provayderlar kesimi" izoh="Tasdiqlangan to'lovlar bo'yicha">
        <ul className="grid gap-2 sm:grid-cols-3">
          {xulosa.provayderlar.length === 0 && (
            <li className="text-sm text-muted">Hali tasdiqlangan to&apos;lov yo&apos;q.</li>
          )}
          {xulosa.provayderlar.map((pr) => (
            <li key={pr.provider} className="rounded-lg border border-line p-3">
              <p className="text-2xs text-faint">{pr.provider}</p>
              <p className="text-sm font-display text-fg tabular-nums">{formatSom(pr.summa)}</p>
              <p className="text-2xs text-muted">{pr.soni} ta to&apos;lov</p>
            </li>
          ))}
        </ul>
      </Bolim>

      <Filtrlar
        qidiruvPlaceholder="To'lov ID, tashqi ID yoki kompaniya"
        tanlovlar={[
          {
            kalit: "status",
            label: "Holat",
            variantlar: [
              { qiymat: "PENDING", label: "Kutilmoqda" },
              { qiymat: "CONFIRMED", label: "Tasdiqlangan" },
              { qiymat: "REJECTED", label: "Rad etilgan" },
            ],
          },
          {
            kalit: "provider",
            label: "Provayder",
            variantlar: [
              { qiymat: "MANUAL", label: "Qo'lda" },
              { qiymat: "PAYME", label: "Payme" },
              { qiymat: "CLICK", label: "Click" },
            ],
          },
        ]}
      />

      <Jadval
        ustunlar={ustunlar}
        qatorlar={natija.qatorlar}
        kalit={(q) => q.id}
        bosh={<FiltrBoshHolat tozalaHref="/superadmin/billing" />}
      />

      <Sahifalash
        sahifa={natija.sahifa}
        sahifalar={natija.sahifalar}
        jami={natija.jami}
        limit={natija.limit}
      />
    </div>
  );
}
