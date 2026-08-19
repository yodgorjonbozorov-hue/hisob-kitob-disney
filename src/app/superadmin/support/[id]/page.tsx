import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r } from "@/lib/superadmin/rbac";
import { tiketTafsiloti, HOLAT_LABEL, MUHIMLIK_LABEL } from "@/lib/superadmin/support";
import { formatToshkentVaqt } from "@/lib/format";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Belgi, MuhimlikBelgisi, TenantStatus } from "@/components/superadmin/belgilar";
import { TiketPaneli } from "@/components/superadmin/TiketPaneli";

export const dynamic = "force-dynamic";

/** TIKET KARTOCHKASI — yozishma va holat boshqaruvi. */
export default async function TiketSahifasi({ params }: { params: { id: string } }) {
  const session = await requireSuperadminRuxsat(r("support", "VIEW"));
  const t = await tiketTafsiloti(params.id);
  if (!t) notFound();

  return (
    <div className="space-y-4">
      <Link href="/superadmin/support" className="text-2xs text-muted hover:text-fg">
        ← Support
      </Link>

      <SahifaSarlavha
        sarlavha={t.mavzu}
        izoh={`${t.tenant.name} · ${formatToshkentVaqt(t.createdAt)}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Belgi ton={t.holat === "OCHIQ" ? "ogoh" : t.holat === "YOPILDI" ? "neytral" : "info"}>
          {HOLAT_LABEL[t.holat] ?? t.holat}
        </Belgi>
        <MuhimlikBelgisi muhimlik={t.muhimlik} label={MUHIMLIK_LABEL[t.muhimlik] ?? t.muhimlik} />
        <TenantStatus status={t.tenant.status} />
        <Link
          href={`/superadmin/bizneslar/${t.tenantId}`}
          className="text-2xs text-brand hover:underline"
        >
          Kompaniya kartochkasi →
        </Link>
        {t.masul && <span className="text-2xs text-muted">Mas&apos;ul: {t.masul.ism}</span>}
      </div>

      <Bolim sarlavha="Yozishma">
        <ul className="space-y-3">
          {t.xabarlar.map((x) => (
            <li
              key={x.id}
              className={
                x.ichki
                  ? "rounded-lg border border-debt-soft bg-debt-soft/30 p-3"
                  : "rounded-lg border border-line p-3"
              }
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-sm font-medium text-fg">{x.muallifIsm}</span>
                {x.ichki && <Belgi ton="ogoh">ichki qayd</Belgi>}
                <span className="text-2xs text-faint ml-auto">
                  {formatToshkentVaqt(x.createdAt)}
                </span>
              </div>
              <p className="text-sm text-fg whitespace-pre-wrap">{x.matn}</p>
            </li>
          ))}
        </ul>
      </Bolim>

      {can(session.superRol, "support", "MANAGE") && (
        <Bolim sarlavha="Javob va holat">
          <TiketPaneli ticketId={t.id} holat={t.holat} muhimlik={t.muhimlik} />
        </Bolim>
      )}
    </div>
  );
}
