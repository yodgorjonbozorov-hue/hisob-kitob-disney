import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r } from "@/lib/superadmin/rbac";
import { biznesTafsiloti } from "@/lib/superadmin/bizneslar";
import { tenantModulHolati } from "@/lib/superadmin/modullar";
import { obunaTarixi } from "@/lib/superadmin/obunalar";
import { tolovlarRoyxati } from "@/lib/superadmin/billing";
import { foydalanuvchilarRoyxati } from "@/lib/superadmin/foydalanuvchilar";
import { auditRoyxati } from "@/lib/superadmin/auditQidiruv";
import { PLANLAR } from "@/lib/billing/plans";
import { formatSom, formatDate, formatRelative } from "@/lib/format";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Kpi, KpiSetka } from "@/components/superadmin/Kpi";
import { TenantStatus, KirishRejimi, Belgi } from "@/components/superadmin/belgilar";
import { BiznesAmallar } from "@/components/superadmin/biznes/BiznesAmallar";
import { ModulPaneli } from "@/components/superadmin/biznes/ModulPaneli";
import { BiznesTablar, type TabKalit } from "@/components/superadmin/biznes/BiznesTablar";
import { BiznesUserlar } from "@/components/superadmin/biznes/BiznesUserlar";
import { BiznesJadvallar } from "@/components/superadmin/biznes/BiznesJadvallar";

export const dynamic = "force-dynamic";

/** BIZNES TAFSILOTI — tab'lar bilan (talab 9-12). */
export default async function BiznesTafsilotSahifasi({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const session = await requireSuperadminRuxsat(r("bizneslar", "VIEW"));
  const t = await biznesTafsiloti(params.id);
  if (!t) notFound();

  const tab = (searchParams.tab ?? "umumiy") as TabKalit;

  const [modullar, userlar, obunalar, tolovlar, auditlar] = await Promise.all([
    tab === "modullar" && can(session.superRol, "modullar", "VIEW")
      ? tenantModulHolati(params.id)
      : [],
    tab === "userlar" && can(session.superRol, "foydalanuvchilar", "VIEW")
      ? foydalanuvchilarRoyxati({ tenantId: params.id }, { sahifa: 1, limit: 100 })
      : null,
    tab === "obuna" && can(session.superRol, "obunalar", "VIEW") ? obunaTarixi(params.id) : [],
    tab === "billing" && can(session.superRol, "billing", "VIEW")
      ? tolovlarRoyxati({ tenantId: params.id }, { sahifa: 1, limit: 50 })
      : null,
    tab === "faoliyat" && can(session.superRol, "audit", "VIEW")
      ? auditRoyxati({ tenantId: params.id }, { sahifa: 1, limit: 50 })
      : null,
  ]);

  return (
    <div className="space-y-4">
      <Link href="/superadmin/bizneslar" className="text-2xs text-muted hover:text-fg">
        ← Bizneslar
      </Link>

      <SahifaSarlavha
        sarlavha={t.name}
        izoh={`${t.slug} · ${t.planNomi} · ${formatDate(t.createdAt)} dan beri`}
        amallar={
          <BiznesAmallar
            tenantId={t.id}
            nomi={t.name}
            status={t.status}
            plan={t.plan}
            bepul={t.bepul}
            superRol={session.superRol}
            tariflar={PLANLAR.map((p) => ({ code: p.code, nomi: p.nomi }))}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <TenantStatus status={t.status} />
        <KirishRejimi mode={t.accessMode} />
        {t.bepul && <Belgi ton="info">doimiy bepul</Belgi>}
        {t.kunQoldi !== null && (
          <Belgi ton={t.kunQoldi < 0 ? "xavf" : t.kunQoldi <= 3 ? "ogoh" : "neytral"}>
            {t.kunQoldi < 0 ? `${-t.kunQoldi} kun o'tib ketgan` : `${t.kunQoldi} kun qoldi`}
          </Belgi>
        )}
        {t.egasi && (
          <span className="text-2xs text-muted">
            Direktor: {t.egasi.ism} ({t.egasi.login}) · Telegram:{" "}
            {t.egasi.telegram ? "ulangan" : "yo'q"}
          </span>
        )}
      </div>

      {t.accessSabab && (
        <p className="text-sm text-debt-fg bg-debt-soft rounded-lg px-3 py-2">{t.accessSabab}</p>
      )}

      <BiznesTablar tenantId={t.id} joriy={tab} superRol={session.superRol} />

      {tab === "umumiy" && (
        <div className="space-y-4">
          <KpiSetka>
            <Kpi label="Foydalanuvchi" qiymat={String(t.jamiUser)} izoh={`${t.faolUser} faol`} />
            <Kpi label="Biznes bo'limi" qiymat={String(t.bizneslar.length)} />
            <Kpi label="Tranzaksiya" qiymat={t.tranzaksiyaSoni.toLocaleString("ru-RU")} />
            <Kpi label="Mahsulot" qiymat={t.mahsulotSoni.toLocaleString("ru-RU")} />
            <Kpi label="Mijoz (CRM)" qiymat={t.mijozSoni.toLocaleString("ru-RU")} />
            <Kpi label="Jami to'lagan" qiymat={formatSom(t.tushum)} ton="muvaffaqiyat" />
            <Kpi
              label="Oxirgi faollik"
              qiymat={t.oxirgiFaollik ? formatRelative(t.oxirgiFaollik) : "hech qachon"}
            />
            <Kpi label="Tarif" qiymat={t.planNomi} />
          </KpiSetka>

          <Bolim sarlavha="Biznes bo'limlari">
            <ul className="divide-y divide-line">
              {t.bizneslar.map((b) => (
                <li key={b.id} className="py-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-fg flex-1 min-w-[160px]">{b.nomi}</span>
                  <Belgi ton="neytral">{b.turi}</Belgi>
                  {b.omborli && <Belgi ton="info">omborli</Belgi>}
                  <Belgi ton={b.isActive ? "muvaffaqiyat" : "neytral"}>
                    {b.isActive ? "faol" : "o'chiq"}
                  </Belgi>
                </li>
              ))}
            </ul>
          </Bolim>
        </div>
      )}

      {tab === "modullar" && (
        <ModulPaneli
          tenantId={t.id}
          ozgartirishMumkin={can(session.superRol, "modullar", "MANAGE")}
          modullar={modullar.map((m) => ({
            ...m,
            createdAt: m.createdAt ? m.createdAt.toISOString() : null,
            oxirgiOzgarish: m.oxirgiOzgarish
              ? { ...m.oxirgiOzgarish, qachon: m.oxirgiOzgarish.qachon.toISOString() }
              : null,
          }))}
        />
      )}

      {tab === "userlar" && (
        <BiznesUserlar
          qatorlar={userlar?.qatorlar ?? []}
          superRol={session.superRol}
          ozId={session.userId}
        />
      )}

      {(tab === "obuna" || tab === "billing" || tab === "faoliyat") && (
        <BiznesJadvallar
          tab={tab}
          obunalar={obunalar}
          tolovlar={tolovlar?.qatorlar ?? []}
          auditlar={auditlar?.qatorlar ?? []}
        />
      )}
    </div>
  );
}
