import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getAccountBalances, listKutilayotganTransferlar } from "@/lib/queries/accounts";
import { getKassaDetal } from "@/lib/queries/kassaDetal";
import { KutilayotganTransferlar } from "@/components/kassa/KutilayotganTransferlar";
import { KassamClient } from "./KassamClient";

/**
 * MENING KASSAM — xodimning o'z kassasidagi pul.
 *
 * Manba — Account ledgeri (Kassalar sahifasi bilan AYNI). Xodimning shaxsiy
 * kassasi bo'lmasa sahifa buni ochiq aytadi: direktor "Kassalar → Shaxsiy
 * kassa rejimi" ni yoqishi kerak, aks holda naqd umumiy kassaga tushadi.
 */
export default async function KassamPage() {
  const { session, tenantId } = await requireTenantPage();
  return runWithTenant(tenantId, async () => {
    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);

    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Mening kassam</h1>
          <p className="text-muted">Sizga biznes biriktirilmagan. Admin bilan bog&apos;laning.</p>
        </div>
      );
    }

    const qoldiqlar = await getAccountBalances(businessId);
    const meniki = qoldiqlar.find((q) => q.userId === session.userId && q.isActive);

    if (!meniki) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Mening kassam</h1>
          <p className="text-sm text-muted">
            Sizda shaxsiy kassa ochilmagan — naqd pul biznesning umumiy kassasiga tushmoqda.
            Direktor <span className="text-fg font-medium">Kassalar → Shaxsiy kassa rejimi</span> ni
            yoqsa, har xodimga o&apos;z kassasi ochiladi.
          </p>
        </div>
      );
    }

    const [detal, kutilayotganlar] = await Promise.all([
      getKassaDetal(businessId, meniki.id, 20),
      listKutilayotganTransferlar(businessId),
    ]);

    // Menga tegishli kutilayotganlar: menga yuborilgan yoki men yuborgan.
    const meniki_kutilayotgan = kutilayotganlar.filter(
      (t) => t.toUserId === session.userId || t.fromUserId === session.userId
    );
    const kutilayotganChiqim = meniki_kutilayotgan
      .filter((t) => t.fromAccountId === meniki.id)
      .reduce((a, t) => a + t.summa, 0);

    const nishonlar = qoldiqlar
      .filter((q) => q.isActive && q.id !== meniki.id)
      .map((q) => ({ id: q.id, nomi: q.nomi, egaIsm: q.egaIsm }));

    // Ism — sahifa sarlavhasida biznes nomi bilan birga ko'rsatiladi.
    const xodim = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { ism: true },
    });

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Mening kassam</h1>
          <p className="text-sm text-muted mt-1">
            {xodim?.ism ?? session.ism} · {business?.nomi ?? "—"} · Qo&apos;lingizdagi naqd pul
          </p>
        </div>

        <KutilayotganTransferlar
          transferlar={meniki_kutilayotgan}
          meniUserId={session.userId}
          boshqaruvchi={false}
        />

        <KassamClient
          accountId={meniki.id}
          qoldiq={detal?.kassa.qoldiq ?? meniki.qoldiq}
          bugungiKirim={detal?.bugungiKirim ?? 0}
          bugungiChiqim={detal?.bugungiChiqim ?? 0}
          harakatlar={detal?.harakatlar ?? []}
          nishonlar={nishonlar}
          kutilayotganChiqim={kutilayotganChiqim}
        />
      </div>
    );
  });
}
