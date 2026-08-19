import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r } from "@/lib/superadmin/rbac";
import { obunalarRoyxati, tariflarQamrovi } from "@/lib/superadmin/obunalar";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { PLANLAR } from "@/lib/billing/plans";
import { formatSom, formatMoneyCompact, formatDate } from "@/lib/format";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Kpi, KpiSetka } from "@/components/superadmin/Kpi";
import { Filtrlar } from "@/components/superadmin/Filtrlar";
import { Jadval, type Ustun } from "@/components/superadmin/Jadval";
import { Sahifalash } from "@/components/superadmin/Sahifalash";
import { TenantStatus, Belgi } from "@/components/superadmin/belgilar";
import { FiltrBoshHolat } from "@/components/superadmin/Holatlar";
import { Eksport } from "@/components/superadmin/Eksport";

export const dynamic = "force-dynamic";

interface Qator {
  tenantId: string;
  nomi: string;
  planNomi: string;
  holat: string;
  bepul: boolean;
  boshlanish: Date | null;
  tugash: Date | null;
  kunQoldi: number | null;
  mrr: number;
  oxirgiTolov: Date | null;
  kutilayotganTolov: number;
}

/** OBUNALAR VA TARIFLAR (talab 18/19). */
export default async function ObunalarSahifasi({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await requireSuperadminRuxsat(r("obunalar", "VIEW"));
  const p = new URLSearchParams(
    Object.entries(searchParams).filter((e): e is [string, string] => e[1] !== undefined)
  );

  const [natija, tariflar] = await Promise.all([
    obunalarRoyxati(
      {
        qidiruv: searchParams.qidiruv ?? null,
        holat: searchParams.holat ?? null,
        plan: searchParams.plan ?? null,
        tugaydiKun: searchParams.tugaydiKun ? Number(searchParams.tugaydiKun) : null,
      },
      sahifaParametrlari(p)
    ),
    tariflarQamrovi(),
  ]);

  const jamiMrr = tariflar.reduce((a, t) => a + t.mrr, 0);

  const ustunlar: Ustun<Qator>[] = [
    { kalit: "nom", sarlavha: "Kompaniya", katak: (q) => q.nomi },
    { kalit: "tarif", sarlavha: "Tarif", katak: (q) => q.planNomi },
    { kalit: "holat", sarlavha: "Holat", katak: (q) => <TenantStatus status={q.holat} /> },
    {
      kalit: "boshi",
      sarlavha: "Boshlanish",
      katak: (q) => (q.boshlanish ? formatDate(new Date(q.boshlanish)) : "—"),
      ikkinchiDarajali: true,
    },
    { kalit: "tugash", sarlavha: "Tugash", katak: (q) => (q.tugash ? formatDate(new Date(q.tugash)) : "—") },
    {
      kalit: "qoldi",
      sarlavha: "Qoldi",
      katak: (q) =>
        q.bepul ? (
          <Belgi ton="info">bepul</Belgi>
        ) : q.kunQoldi === null ? (
          "—"
        ) : (
          <Belgi ton={q.kunQoldi < 0 ? "xavf" : q.kunQoldi <= 3 ? "ogoh" : "neytral"}>
            {q.kunQoldi < 0 ? `${-q.kunQoldi} kun o'tdi` : `${q.kunQoldi} kun`}
          </Belgi>
        ),
    },
    { kalit: "mrr", sarlavha: "MRR", raqam: true, katak: (q) => (q.mrr > 0 ? formatMoneyCompact(q.mrr) : "—") },
    {
      kalit: "tolov",
      sarlavha: "Oxirgi to'lov",
      katak: (q) => (q.oxirgiTolov ? formatDate(new Date(q.oxirgiTolov)) : "—"),
      ikkinchiDarajali: true,
    },
    {
      kalit: "kutilmoqda",
      sarlavha: "Kutilmoqda",
      raqam: true,
      katak: (q) => (q.kutilayotganTolov > 0 ? <Belgi ton="ogoh">{q.kutilayotganTolov}</Belgi> : "—"),
    },
  ];

  return (
    <div className="space-y-4">
      <SahifaSarlavha
        sarlavha="Obunalar"
        izoh="Har mijozning tarifi, muddati va oylik tushumi"
        amallar={can(session.superRol, "eksport", "VIEW") ? <Eksport turi="obunalar" /> : null}
      />

      <KpiSetka>
        <Kpi label="Jami MRR" qiymat={`${formatMoneyCompact(jamiMrr)} so'm`} ton="muvaffaqiyat" />
        {tariflar.map((t) => (
          <Kpi
            key={t.code}
            label={t.nomi}
            qiymat={String(t.soni)}
            izoh={`${formatMoneyCompact(t.mrr)} so'm/oy · ${formatSom(t.oylikNarx)}`}
          />
        ))}
      </KpiSetka>

      <Bolim sarlavha="Tarif va modul mosligi" izoh="Tarif o'zgarsa modullar shu ro'yxat bo'yicha ochiladi">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PLANLAR.map((t) => (
            <li key={t.code} className="rounded-lg border border-line p-3">
              <p className="text-sm font-medium text-fg">
                {t.nomi} · {formatSom(t.oylikNarx)}/oy
              </p>
              <p className="text-2xs text-muted mt-1">{t.modullar.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </Bolim>

      <Filtrlar
        qidiruvPlaceholder="Kompaniya nomi"
        tanlovlar={[
          {
            kalit: "holat",
            label: "Holat",
            variantlar: [
              { qiymat: "TRIAL", label: "Sinov" },
              { qiymat: "ACTIVE", label: "Faol" },
              { qiymat: "PAST_DUE", label: "Muddati o'tgan" },
              { qiymat: "BLOCKED", label: "Bloklangan" },
            ],
          },
          { kalit: "plan", label: "Tarif", variantlar: PLANLAR.map((x) => ({ qiymat: x.code, label: x.nomi })) },
          {
            kalit: "tugaydiKun",
            label: "Tugayapti",
            variantlar: [
              { qiymat: "3", label: "3 kun ichida" },
              { qiymat: "7", label: "7 kun ichida" },
              { qiymat: "30", label: "30 kun ichida" },
            ],
          },
        ]}
      />

      <Jadval
        ustunlar={ustunlar}
        qatorlar={natija.qatorlar}
        kalit={(q) => q.tenantId}
        qatorHref={(q) => `/superadmin/bizneslar/${q.tenantId}?tab=obuna`}
        bosh={<FiltrBoshHolat tozalaHref="/superadmin/obunalar" />}
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
