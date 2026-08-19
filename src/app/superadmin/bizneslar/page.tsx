import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r } from "@/lib/superadmin/rbac";
import { bizneslarRoyxati, type BiznesSaralash } from "@/lib/superadmin/bizneslar";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { PLANLAR } from "@/lib/billing/plans";
import { MODULLAR } from "@/lib/modules/registry";
import { formatMoneyCompact, formatRelative, formatDate } from "@/lib/format";
import { SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Filtrlar } from "@/components/superadmin/Filtrlar";
import { Jadval, type Ustun } from "@/components/superadmin/Jadval";
import { Sahifalash } from "@/components/superadmin/Sahifalash";
import { TenantStatus, KirishRejimi, Belgi } from "@/components/superadmin/belgilar";
import { FiltrBoshHolat } from "@/components/superadmin/Holatlar";
import { YangiMijoz } from "@/components/superadmin/YangiMijoz";
import { Eksport } from "@/components/superadmin/Eksport";

export const dynamic = "force-dynamic";

interface Qator {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  bepul: boolean;
  accessMode: string;
  createdAt: Date;
  deadline: Date | null;
  userCount: number;
  businessCount: number;
  modulSoni: number;
  lastActivity: Date | null;
  pendingPayments: number;
  tushum: number;
}

/** BIZNESLAR — SaaS tenant boshqaruvi (talab 8). */
export default async function BizneslarSahifasi({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await requireSuperadminRuxsat(r("bizneslar", "VIEW"));
  const p = new URLSearchParams(
    Object.entries(searchParams).filter((e): e is [string, string] => e[1] !== undefined)
  );

  const natija = await bizneslarRoyxati(
    {
      qidiruv: searchParams.qidiruv ?? null,
      status: searchParams.status ?? null,
      plan: searchParams.plan ?? null,
      modul: searchParams.modul ?? null,
      bepul: searchParams.bepul === "ha" ? true : searchParams.bepul === "yoq" ? false : null,
      saralash: (searchParams.saralash ?? "yangi") as BiznesSaralash,
    },
    sahifaParametrlari(p)
  );

  const ustunlar: Ustun<Qator>[] = [
    { kalit: "nom", sarlavha: "Kompaniya", katak: (q) => q.name },
    { kalit: "status", sarlavha: "Holat", katak: (q) => <TenantStatus status={q.status} /> },
    {
      kalit: "tarif",
      sarlavha: "Tarif",
      katak: (q) => (
        <span className="flex items-center gap-1">
          {q.plan}
          {q.bepul && <Belgi ton="info">bepul</Belgi>}
        </span>
      ),
    },
    { kalit: "kirish", sarlavha: "Kirish", katak: (q) => <KirishRejimi mode={q.accessMode} />, ikkinchiDarajali: true },
    { kalit: "modul", sarlavha: "Modul", raqam: true, katak: (q) => q.modulSoni },
    { kalit: "user", sarlavha: "Foydalanuvchi", raqam: true, katak: (q) => q.userCount },
    { kalit: "biznes", sarlavha: "Biznes", raqam: true, katak: (q) => q.businessCount, ikkinchiDarajali: true },
    {
      kalit: "tushum",
      sarlavha: "Tushum",
      raqam: true,
      katak: (q) => (q.tushum > 0 ? formatMoneyCompact(q.tushum) : "—"),
    },
    {
      kalit: "muddat",
      sarlavha: "Muddat",
      katak: (q) => (q.deadline ? formatDate(new Date(q.deadline)) : "—"),
      ikkinchiDarajali: true,
    },
    {
      kalit: "faollik",
      sarlavha: "Oxirgi faollik",
      katak: (q) => (q.lastActivity ? formatRelative(new Date(q.lastActivity)) : "hech qachon"),
    },
    {
      kalit: "tolov",
      sarlavha: "Kutilayotgan",
      raqam: true,
      katak: (q) => (q.pendingPayments > 0 ? <Belgi ton="ogoh">{q.pendingPayments}</Belgi> : "—"),
      ikkinchiDarajali: true,
    },
  ];

  return (
    <div className="space-y-4">
      <SahifaSarlavha
        sarlavha="Bizneslar"
        izoh={`${natija.jami.toLocaleString("ru-RU")} ta mijoz kompaniya`}
        amallar={
          <>
            {can(session.superRol, "eksport", "VIEW") && <Eksport turi="bizneslar" />}
            {can(session.superRol, "bizneslar", "CREATE") && (
              <YangiMijoz tariflar={PLANLAR.map((x) => ({ code: x.code, nomi: x.nomi }))} />
            )}
          </>
        }
      />

      <Filtrlar
        qidiruvPlaceholder="Kompaniya nomi, slug yoki ID"
        tanlovlar={[
          {
            kalit: "status",
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
            kalit: "modul",
            label: "Modul",
            variantlar: MODULLAR.filter((m) => !m.korinmas && !m.core).map((m) => ({
              qiymat: m.code,
              label: m.nomi,
            })),
          },
          {
            kalit: "saralash",
            label: "Saralash",
            variantlar: [
              { qiymat: "yangi", label: "Yangi" },
              { qiymat: "eski", label: "Eski" },
              { qiymat: "nom", label: "Nom" },
              { qiymat: "faollik", label: "Faollik" },
              { qiymat: "tushum", label: "Tushum" },
            ],
          },
        ]}
      />

      {natija.sahifaIchidaSaralandi && (
        <p className="text-2xs text-muted">
          Diqqat: &quot;faollik&quot; va &quot;tushum&quot; bo&apos;yicha saralash joriy sahifa
          ichida bajariladi (bu maydonlar kompaniya jadvalida saqlanmaydi).
        </p>
      )}

      <Jadval
        ustunlar={ustunlar}
        qatorlar={natija.qatorlar}
        kalit={(q) => q.id}
        qatorHref={(q) => `/superadmin/bizneslar/${q.id}`}
        bosh={<FiltrBoshHolat tozalaHref="/superadmin/bizneslar" />}
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
