import Link from "next/link";
import { requireSuperadminPage } from "@/lib/auth/superadmin";
import { can } from "@/lib/superadmin/rbac";
import { dashboardMalumot, davrniHisobla, DAVRLAR, type DavrKalit } from "@/lib/superadmin/dashboard";
import { getKassaMetrikalari } from "@/lib/superadmin/kassa";
import { formatMoneyCompact, formatRelative } from "@/lib/format";
import { Kpi, KpiSetka } from "@/components/superadmin/Kpi";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { ChiziqliGrafik, UstunliGrafik } from "@/components/superadmin/Grafik";
import { Belgi } from "@/components/superadmin/belgilar";
import { BoshHolat } from "@/components/superadmin/Holatlar";
import { KassaMetrikalari } from "./KassaMetrikalari";

export const dynamic = "force-dynamic";

/**
 * OVERVIEW — Control Center bosh sahifasi (talab 4-7, 60).
 *
 * Sahifa 10 ta savolga javob beradi: nechta biznes, nechtasi faol, nechta
 * yangi, tushum, MRR, muammoli obunalar, ishlamayotgan tizimlar, xavfsizlik
 * signali, eng ko'p ishlatilayotgan modullar va superadminlar nima qilgani.
 */
export default async function ControlCenterHome({
  searchParams,
}: {
  searchParams: { davr?: string };
}) {
  const session = await requireSuperadminPage();
  const kalit = (searchParams.davr ?? "30kun") as DavrKalit;
  const davr = davrniHisobla(kalit);

  const [m, kassa] = await Promise.all([
    dashboardMalumot(davr),
    // Kassir kassalari kesimi — biznes hisobotlaridan ALOHIDA ko'rsatkich.
    getKassaMetrikalari(),
  ]);

  const ogohTon = {
    KRITIK: "xavf" as const,
    OGOHLANTIRISH: "ogoh" as const,
    MALUMOT: "info" as const,
  };

  return (
    <div className="space-y-5">
      <SahifaSarlavha
        sarlavha={`Salom, ${session.ism}`}
        izoh="Platformaning joriy holati — raqamlar tanlangan davr bo'yicha."
        amallar={
          <div className="flex rounded-lg border border-line overflow-hidden" role="group" aria-label="Davr">
            {DAVRLAR.map((d) => (
              <Link
                key={d.kalit}
                href={`/superadmin?davr=${d.kalit}`}
                className={
                  d.kalit === kalit
                    ? "px-3 py-1.5 text-2xs bg-brand text-brand-fg"
                    : "px-3 py-1.5 text-2xs text-muted hover:bg-surface-2"
                }
              >
                {d.label}
              </Link>
            ))}
          </div>
        }
      />

      <KpiSetka>
        <Kpi label="Jami biznes" qiymat={String(m.kpi.jamiBiznes)} href="/superadmin/bizneslar" />
        <Kpi
          label="Faol biznes"
          qiymat={String(m.kpi.faolBiznes)}
          izoh={`${m.kpi.bloklangan} bloklangan`}
          ton="muvaffaqiyat"
        />
        <Kpi label={`Yangi (${davr.label})`} qiymat={`+${m.kpi.yangiBiznes}`} />
        <Kpi label="Sinovda" qiymat={String(m.kpi.sinovdagi)} href="/superadmin/obunalar?holat=TRIAL" />
        <Kpi label="Pullik obuna" qiymat={String(m.kpi.pullikBiznes)} ton="muvaffaqiyat" />
        <Kpi label="Faol foydalanuvchi" qiymat={String(m.kpi.faolFoydalanuvchi)} izoh={`jami ${m.kpi.jamiFoydalanuvchi}`} />
        <Kpi label="MRR" qiymat={`${formatMoneyCompact(m.kpi.mrr)} so'm`} ton="muvaffaqiyat" href="/superadmin/obunalar" />
        <Kpi label={`Tushum (${davr.label})`} qiymat={`${formatMoneyCompact(m.kpi.davrTushum)} so'm`} href="/superadmin/billing" />
        <Kpi
          label="Churn"
          qiymat={m.kpi.churnFoiz === null ? String(m.kpi.churn) : `${m.kpi.churn} · ${m.kpi.churnFoiz}%`}
          izoh="Muddati tugab yangilanmagan"
          ton={m.kpi.churn > 0 ? "ogoh" : "neytral"}
        />
        <Kpi
          label="Tizim holati"
          qiymat={m.kpi.tizimSoglik}
          ton={m.kpi.tizimSoglik === "SOG'LOM" ? "muvaffaqiyat" : m.kpi.tizimSoglik === "KRITIK" ? "xavf" : "ogoh"}
          href="/superadmin/tizim"
        />
      </KpiSetka>

      <Bolim sarlavha="E'tibor talab qiladi" izoh="Har satr — bajarilishi kerak bo'lgan aniq ish">
        {m.ogohlantirishlar.length === 0 ? (
          <BoshHolat sarlavha="Hammasi joyida" izoh="Hozircha harakat talab qiladigan holat yo'q." />
        ) : (
          <ul className="space-y-2">
            {m.ogohlantirishlar.map((o) => (
              <li
                key={o.sarlavha}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2"
              >
                <Belgi ton={ogohTon[o.daraja]}>{o.daraja}</Belgi>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-medium text-fg">{o.sarlavha}</p>
                  <p className="text-2xs text-muted">{o.matn}</p>
                </div>
                <Link href={o.href} className="text-2xs text-brand font-medium hover:underline">
                  Ko&apos;rish →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Bolim>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bolim sarlavha="Biznes o'sishi" izoh={`Yangi kompaniyalar · ${davr.label}`}>
          <ChiziqliGrafik nuqtalar={m.biznesOsishi} />
        </Bolim>
        <Bolim sarlavha="Foydalanuvchi o'sishi" izoh={`Yangi hisoblar · ${davr.label}`}>
          <ChiziqliGrafik nuqtalar={m.foydalanuvchiOsishi} />
        </Bolim>
        <Bolim sarlavha="Tushum" izoh={`Tasdiqlangan to'lovlar · ${davr.label}`}>
          <ChiziqliGrafik nuqtalar={m.tushumOsishi} pul />
        </Bolim>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bolim sarlavha="Modul qamrovi" izoh="Nechta kompaniyada yoqilgan">
          <UstunliGrafik nuqtalar={m.modulQamrovi.map((x) => ({ nomi: x.nomi, qiymat: x.soni }))} />
        </Bolim>

        <Bolim
          sarlavha="Superadminlar faoliyati"
          izoh="O'zgarmas audit jurnalidan"
          amallar={
            can(session.superRol, "audit", "VIEW") ? (
              <Link href="/superadmin/audit?faqatSuperadmin=ha" className="text-2xs text-brand hover:underline">
                Hammasi →
              </Link>
            ) : null
          }
        >
          {m.faoliyat.length === 0 ? (
            <BoshHolat sarlavha="Hali imtiyozli amal qayd etilmagan" />
          ) : (
            <ul className="divide-y divide-line">
              {m.faoliyat.map((f) => (
                <li key={f.id} className="py-2 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg">
                      <span className="font-medium">{f.amalLabel}</span>
                      <span className="text-muted"> · {f.entity}</span>
                    </p>
                    <p className="text-2xs text-muted truncate">
                      {f.kim ?? "—"}
                      {f.sabab ? ` · ${f.sabab}` : ""}
                    </p>
                  </div>
                  <span className="text-2xs text-faint whitespace-nowrap">
                    {formatRelative(new Date(f.createdAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bolim>
      </div>

      <Bolim
        sarlavha="Kassir kassalari (platforma kesimi)"
        izoh="Bu raqamlar biznes hisobotlariga ta'sir qilmaydi — kassirlarning qo'lidagi naqd."
      >
        <KassaMetrikalari m={kassa} />
      </Bolim>
    </div>
  );
}
