import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r } from "@/lib/superadmin/rbac";
import { tiketlarRoyxati, supportXulosa, HOLAT_LABEL, MUHIMLIK_LABEL } from "@/lib/superadmin/support";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { formatRelative } from "@/lib/format";
import { SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Kpi, KpiSetka } from "@/components/superadmin/Kpi";
import { Filtrlar } from "@/components/superadmin/Filtrlar";
import { Jadval, type Ustun } from "@/components/superadmin/Jadval";
import { Sahifalash } from "@/components/superadmin/Sahifalash";
import { Belgi, MuhimlikBelgisi } from "@/components/superadmin/belgilar";
import { FiltrBoshHolat } from "@/components/superadmin/Holatlar";
import { YangiTiket } from "@/components/superadmin/YangiTiket";

export const dynamic = "force-dynamic";

interface Qator {
  id: string;
  tenantId: string;
  tenantNomi: string;
  mavzu: string;
  holat: string;
  muhimlik: string;
  masulIsm: string | null;
  xabarSoni: number;
  updatedAt: Date;
}

/** SUPPORT MARKAZI (talab 21). */
export default async function SupportSahifasi({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await requireSuperadminRuxsat(r("support", "VIEW"));
  const p = new URLSearchParams(
    Object.entries(searchParams).filter((e): e is [string, string] => e[1] !== undefined)
  );

  const [natija, xulosa] = await Promise.all([
    tiketlarRoyxati(
      {
        qidiruv: searchParams.qidiruv ?? null,
        holat: searchParams.holat ?? null,
        muhimlik: searchParams.muhimlik ?? null,
      },
      sahifaParametrlari(p)
    ),
    supportXulosa(),
  ]);

  const ustunlar: Ustun<Qator>[] = [
    { kalit: "mavzu", sarlavha: "Mavzu", katak: (q) => q.mavzu },
    { kalit: "tenant", sarlavha: "Kompaniya", katak: (q) => q.tenantNomi },
    {
      kalit: "muhimlik",
      sarlavha: "Muhimlik",
      katak: (q) => <MuhimlikBelgisi muhimlik={q.muhimlik} label={MUHIMLIK_LABEL[q.muhimlik] ?? q.muhimlik} />,
    },
    {
      kalit: "holat",
      sarlavha: "Holat",
      katak: (q) => (
        <Belgi ton={q.holat === "OCHIQ" ? "ogoh" : q.holat === "YOPILDI" ? "neytral" : "info"}>
          {HOLAT_LABEL[q.holat] ?? q.holat}
        </Belgi>
      ),
    },
    { kalit: "masul", sarlavha: "Mas'ul", katak: (q) => q.masulIsm ?? "—" },
    { kalit: "xabar", sarlavha: "Xabar", raqam: true, katak: (q) => q.xabarSoni, ikkinchiDarajali: true },
    { kalit: "yangilangan", sarlavha: "Oxirgi harakat", katak: (q) => formatRelative(new Date(q.updatedAt)) },
  ];

  return (
    <div className="space-y-4">
      <SahifaSarlavha
        sarlavha="Support"
        izoh="Mijoz muammolari bo'yicha tiketlar"
        amallar={can(session.superRol, "support", "MANAGE") ? <YangiTiket /> : null}
      />

      <KpiSetka>
        <Kpi label="Ochiq" qiymat={String(xulosa.ochiq)} ton={xulosa.ochiq > 0 ? "ogoh" : "neytral"} href="/superadmin/support?holat=OCHIQ" />
        <Kpi label="Javob kutilmoqda" qiymat={String(xulosa.kutilmoqda)} />
        <Kpi label="Yechildi" qiymat={String(xulosa.yechildi)} ton="muvaffaqiyat" />
        <Kpi label="Yopilgan" qiymat={String(xulosa.yopilgan)} />
        <Kpi label="Kritik (ochiq)" qiymat={String(xulosa.kritik)} ton={xulosa.kritik > 0 ? "xavf" : "neytral"} />
      </KpiSetka>

      <Filtrlar
        qidiruvPlaceholder="Mavzu, tavsif yoki tiket ID"
        tanlovlar={[
          {
            kalit: "holat",
            label: "Holat",
            variantlar: Object.entries(HOLAT_LABEL).map(([q, l]) => ({ qiymat: q, label: l })),
          },
          {
            kalit: "muhimlik",
            label: "Muhimlik",
            variantlar: Object.entries(MUHIMLIK_LABEL).map(([q, l]) => ({ qiymat: q, label: l })),
          },
        ]}
      />

      <Jadval
        ustunlar={ustunlar}
        qatorlar={natija.qatorlar}
        kalit={(q) => q.id}
        qatorHref={(q) => `/superadmin/support/${q.id}`}
        bosh={
          natija.jami === 0 && !searchParams.qidiruv ? (
            <div className="py-10 text-center">
              <p className="font-medium text-fg">Hali tiket yo&apos;q</p>
              <p className="text-sm text-muted mt-1">
                Mijoz muammosi qayd etilishi kerak bo&apos;lsa &quot;Yangi tiket&quot; tugmasidan
                foydalaning.
              </p>
            </div>
          ) : (
            <FiltrBoshHolat tozalaHref="/superadmin/support" />
          )
        }
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
