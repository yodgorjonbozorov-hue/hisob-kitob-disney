import { requireSuperadminRuxsat } from "@/lib/auth/superadmin";
import { can, r } from "@/lib/superadmin/rbac";
import { auditRoyxati, auditFiltrVariantlari } from "@/lib/superadmin/auditQidiruv";
import { xavfsizlikXulosa } from "@/lib/superadmin/xavfsizlik";
import { amalLabel } from "@/lib/superadmin/audit";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { formatToshkentVaqt } from "@/lib/format";
import { Bolim, SahifaSarlavha } from "@/components/superadmin/Bolim";
import { Kpi, KpiSetka } from "@/components/superadmin/Kpi";
import { Filtrlar } from "@/components/superadmin/Filtrlar";
import { Sahifalash } from "@/components/superadmin/Sahifalash";
import { Eksport } from "@/components/superadmin/Eksport";
import { AuditJadvali } from "@/components/superadmin/AuditJadvali";

export const dynamic = "force-dynamic";

/**
 * AUDIT VA XAVFSIZLIK (talab 22-25).
 *
 * Jurnal FAQAT O'QISH uchun: bu sahifada o'chirish yoki tahrirlash amali
 * YO'Q, chunki `AuditLog` append-only (lib/db/rawPrisma.ts). Superadmin ham
 * o'z izini o'chira olmaydi.
 */
export default async function AuditSahifasi({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const session = await requireSuperadminRuxsat(r("audit", "VIEW"));
  const p = new URLSearchParams(
    Object.entries(searchParams).filter((e): e is [string, string] => e[1] !== undefined)
  );

  const xavfsizlikOchiq = can(session.superRol, "xavfsizlik", "VIEW");

  const [natija, variantlar, xavfsizlik] = await Promise.all([
    auditRoyxati(
      {
        qidiruv: searchParams.qidiruv ?? null,
        action: searchParams.amal ?? null,
        entity: searchParams.entity ?? null,
        faqatSuperadmin: searchParams.faqatSuperadmin === "ha",
      },
      sahifaParametrlari(p)
    ),
    auditFiltrVariantlari(),
    xavfsizlikOchiq ? xavfsizlikXulosa() : null,
  ]);

  return (
    <div className="space-y-4">
      <SahifaSarlavha
        sarlavha="Audit va xavfsizlik"
        izoh="O'zgarmas jurnal: kim, nima, qachon, qayerdan va nega"
        amallar={can(session.superRol, "eksport", "VIEW") ? <Eksport turi="audit" /> : null}
      />

      {xavfsizlik && (
        <>
          <KpiSetka>
            <Kpi
              label="Muvaffaqiyatsiz kirish (24s)"
              qiymat={String(xavfsizlik.muvaffaqiyatsiz24)}
              ton={xavfsizlik.muvaffaqiyatsiz24 >= 10 ? "xavf" : "neytral"}
            />
            <Kpi label="Muvaffaqiyatsiz (7 kun)" qiymat={String(xavfsizlik.muvaffaqiyatsiz7kun)} />
            <Kpi label="Muvaffaqiyatli kirish (24s)" qiymat={String(xavfsizlik.muvaffaqiyatli24)} />
            <Kpi
              label="Faol sessiyalar"
              qiymat={String(xavfsizlik.faolSessiyalar)}
              izoh="Taxminiy: 7 kun ichida kirganlar"
            />
            <Kpi
              label="Telegram ulangan rahbar"
              qiymat={`${xavfsizlik.telegramUlangan} / ${xavfsizlik.telegramJami}`}
              izoh="Ikkinchi aloqa kanali"
              ton={
                xavfsizlik.telegramJami > 0 && xavfsizlik.telegramUlangan < xavfsizlik.telegramJami
                  ? "ogoh"
                  : "neytral"
              }
            />
            <Kpi label="Bloklangan hisob" qiymat={String(xavfsizlik.bloklanganUser)} />
            <Kpi label="Superadmin hisobi" qiymat={String(xavfsizlik.superadminSoni)} />
          </KpiSetka>

          <div className="grid gap-4 lg:grid-cols-2">
            <Bolim
              sarlavha="Ko'p urinilgan loginlar"
              izoh="Oxirgi 7 kundagi muvaffaqiyatsiz kirishlar"
            >
              {xavfsizlik.shubhaliLoginlar.length === 0 ? (
                <p className="text-sm text-muted">Muvaffaqiyatsiz urinish qayd etilmagan.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {xavfsizlik.shubhaliLoginlar.map((s) => (
                    <li key={s.login} className="py-2 flex items-center gap-3">
                      <span className="flex-1 text-sm text-fg truncate">{s.login}</span>
                      <span className="text-2xs text-muted">{s.ipSoni} IP</span>
                      <span className="text-sm tabular-nums text-expense-fg">{s.soni}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Bolim>

            <Bolim
              sarlavha="Bir necha IP dan kirganlar"
              izoh="Oxirgi 24 soat — sessiya anomaliyasi belgisi"
            >
              {xavfsizlik.kopIpdanKirganlar.length === 0 ? (
                <p className="text-sm text-muted">Anomaliya aniqlanmadi.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {xavfsizlik.kopIpdanKirganlar.map((s) => (
                    <li key={s.login} className="py-2 flex items-center gap-3">
                      <span className="flex-1 text-sm text-fg truncate">{s.login}</span>
                      <span className="text-sm tabular-nums text-debt-fg">{s.ipSoni} IP</span>
                    </li>
                  ))}
                </ul>
              )}
            </Bolim>
          </div>
        </>
      )}

      <Bolim sarlavha="Jurnal" izoh="Append-only — bu yerda o'chirish amali yo'q">
        <div className="space-y-3">
          <Filtrlar
            qidiruvPlaceholder="Obyekt ID, ism, IP yoki sabab"
            tanlovlar={[
              {
                kalit: "amal",
                label: "Amal",
                variantlar: variantlar.amallar.map((a) => ({ qiymat: a, label: amalLabel(a) })),
              },
              {
                kalit: "entity",
                label: "Obyekt",
                variantlar: variantlar.entitylar.map((e) => ({ qiymat: e, label: e })),
              },
              {
                kalit: "faqatSuperadmin",
                label: "Manba",
                variantlar: [{ qiymat: "ha", label: "Faqat superadmin amallari" }],
              },
            ]}
          />

          <AuditJadvali
            qatorlar={natija.qatorlar.map((q) => ({
              id: q.id,
              vaqt: formatToshkentVaqt(q.createdAt),
              kim: q.kim,
              amalLabel: q.amalLabel,
              entity: q.entity,
              entityId: q.entityId,
              tenantNomi: q.tenantNomi,
              ip: q.ip,
              userAgent: q.userAgent,
              sabab: q.sabab,
              before: q.before,
              after: q.after,
            }))}
          />

          <Sahifalash
            sahifa={natija.sahifa}
            sahifalar={natija.sahifalar}
            jami={natija.jami}
            limit={natija.limit}
          />
        </div>
      </Bolim>
    </div>
  );
}
