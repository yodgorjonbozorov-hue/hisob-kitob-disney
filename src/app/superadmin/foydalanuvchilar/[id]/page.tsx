import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r, SUPER_ROL_LABEL, SUPER_ROLLAR, rolMatritsasi, RESURS_LABEL } from "@/lib/superadmin/rbac";
import { userTafsiloti } from "@/lib/superadmin/foydalanuvchilar";
import { amalLabel } from "@/lib/superadmin/audit";
import { formatDate, formatRelative, formatToshkentVaqt } from "@/lib/format";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Kpi, KpiSetka } from "@/components/superadmin/Kpi";
import { Belgi } from "@/components/superadmin/belgilar";
import { BoshHolat } from "@/components/superadmin/Holatlar";
import { UserAmallar } from "@/components/superadmin/UserAmallar";
import { SuperadminRolTanlov } from "@/components/superadmin/SuperadminRolTanlov";

export const dynamic = "force-dynamic";

/** FOYDALANUVCHI KARTOCHKASI (talab 15). */
export default async function UserTafsilotSahifasi({ params }: { params: { id: string } }) {
  const session = await requireSuperadminRuxsat(r("foydalanuvchilar", "VIEW"));
  const u = await userTafsiloti(params.id);
  if (!u) notFound();

  const matritsa = u.superadminRol ? rolMatritsasi(u.superadminRol) : null;

  return (
    <div className="space-y-4">
      <Link href="/superadmin/foydalanuvchilar" className="text-2xs text-muted hover:text-fg">
        ← Foydalanuvchilar
      </Link>

      <SahifaSarlavha
        sarlavha={u.ism}
        izoh={`${u.login} · ${u.rolLabel}${u.tenantNomi ? ` · ${u.tenantNomi}` : " · platforma hisobi"}`}
        amallar={
          <UserAmallar
            userId={u.id}
            ism={u.ism}
            login={u.login}
            isActive={u.isActive}
            superRol={session.superRol}
            ozimi={u.id === session.userId}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Belgi ton={u.isActive ? "muvaffaqiyat" : "xavf"}>{u.isActive ? "faol" : "bloklangan"}</Belgi>
        {u.superadminRol && <Belgi ton="brend">{SUPER_ROL_LABEL[u.superadminRol]}</Belgi>}
        {u.maxsusRol && <Belgi ton="info">maxsus rol: {u.maxsusRol}</Belgi>}
        {u.mustChangePassword && <Belgi ton="ogoh">parol almashtirishi kerak</Belgi>}
        {u.telegramUlangan && <Belgi ton="neytral">Telegram ulangan</Belgi>}
      </div>

      <KpiSetka>
        <Kpi label="Yaratilgan" qiymat={formatDate(u.createdAt)} />
        <Kpi
          label="Oxirgi kirish"
          qiymat={u.lastLoginAt ? formatRelative(u.lastLoginAt) : "hech qachon"}
        />
        <Kpi
          label="Sessiya avlodi"
          qiymat={String(u.sessionEpoch)}
          izoh="Har bekor qilishda oshadi"
        />
        <Kpi
          label="Muvaffaqiyatsiz kirish"
          qiymat={String(u.muvaffaqiyatsizKirish)}
          izoh="Oxirgi 30 kun"
          ton={u.muvaffaqiyatsizKirish >= 5 ? "ogoh" : "neytral"}
        />
        <Kpi label="Biriktirilgan biznes" qiymat={u.businessNomi ?? "—"} />
      </KpiSetka>

      {u.superadminRol && (
        <Bolim
          sarlavha="Superadmin huquqlari"
          izoh="Matritsa lib/superadmin/rbac.ts dagi yagona manbadan olinadi"
          amallar={
            can(session.superRol, "sozlamalar", "MANAGE") && u.id !== session.userId ? (
              <SuperadminRolTanlov
                userId={u.id}
                ism={u.ism}
                joriy={u.superadminRol}
                rollar={SUPER_ROLLAR.map((x) => ({ kod: x, label: SUPER_ROL_LABEL[x] }))}
              />
            ) : null
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {matritsa &&
              Object.entries(matritsa).map(([resurs, amallar]) => (
                <div key={resurs} className="rounded-lg border border-line p-2">
                  <p className="text-2xs text-faint">{RESURS_LABEL[resurs as keyof typeof RESURS_LABEL]}</p>
                  <p className="text-sm text-fg">
                    {amallar.length === 0 ? (
                      <span className="text-faint">ruxsat yo&apos;q</span>
                    ) : (
                      amallar.join(" · ")
                    )}
                  </p>
                </div>
              ))}
          </div>
        </Bolim>
      )}

      <Bolim sarlavha="Oxirgi faoliyat" izoh="Audit jurnalidagi oxirgi 20 yozuv">
        {u.faoliyat.length === 0 ? (
          <BoshHolat sarlavha="Jurnalda yozuv yo'q" />
        ) : (
          <ul className="divide-y divide-line">
            {u.faoliyat.map((f) => (
              <li key={f.id} className="py-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-fg flex-1 min-w-[160px]">{amalLabel(f.action)}</span>
                <span className="text-2xs text-muted">{f.entity}</span>
                {f.ip && <span className="text-2xs text-faint font-mono">{f.ip}</span>}
                <span className="text-2xs text-faint">{formatToshkentVaqt(f.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Bolim>
    </div>
  );
}
