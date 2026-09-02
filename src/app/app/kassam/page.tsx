import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listAccounts, listKutilayotganTransferlar } from "@/lib/queries/accounts";
import { getKassaDetal } from "@/lib/queries/kassaDetal";
import { KutilayotganTransferlar } from "@/components/kassa/KutilayotganTransferlar";
import { KassamClient } from "./KassamClient";

/**
 * MENING KASSAM — xodimning o'z kassasidagi pul.
 *
 * Manba — Account ledgeri (Kassalar sahifasi bilan AYNI). Xodimning shaxsiy
 * kassasi bo'lmasa sahifa buni ochiq aytadi: direktor "Kassalar → Shaxsiy
 * kassa rejimi" ni yoqishi kerak, aks holda naqd umumiy kassaga tushadi.
 *
 * ═══ KASSA MAXFIYLIGI ═══
 * Bu sahifa xodimga faqat O'Z kassasini ko'rsatadi: boshqa kassalarning
 * qoldig'i, biznesning jami puli va boshqa xodimlar orasidagi o'tkazmalar
 * bu yerga tushmaydi. Topshirish nishonlari — faqat NOM (summasiz).
 * Tasdiq kutayotganlar — faqat men yuborgan yoki menga yuborilganlar
 * (server tomonda kesiladi, `listKutilayotganTransferlar`).
 *
 * ═══ JORIY SMENA ═══
 * Kirim/chiqim/sof — oxirgi topshirishdan beri. Kassa topshirilgan zahoti
 * ular 0 dan boshlanadi, "Kassangizdagi pul" esa MAVJUD pul (tasdiq
 * kutayotgan topshirish ayrilgan). Tarix pastdagi lentada to'liq qoladi.
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

    // Faqat O'Z kassasi qidiriladi — boshqa kassalarning qoldig'i hisoblanmaydi.
    const meniki = await prisma.account.findFirst({
      where: { businessId, userId: session.userId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

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

    const [detal, kutilayotganlar, faolKassalar, xodim] = await Promise.all([
      getKassaDetal(businessId, meniki.id, 20),
      listKutilayotganTransferlar(businessId, 50, session.userId),
      // Nishonlar — nomlar, summasiz (kassa maxfiyligi).
      listAccounts(businessId, true),
      // Ism — sahifa sarlavhasida biznes nomi bilan birga ko'rsatiladi.
      prisma.user.findUnique({ where: { id: session.userId }, select: { ism: true } }),
    ]);
    if (!detal) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Mening kassam</h1>
          <p className="text-muted">Kassa topilmadi.</p>
        </div>
      );
    }

    const nishonlar = faolKassalar
      .filter((q) => q.id !== meniki.id)
      .map((q) => ({ id: q.id, nomi: q.nomi, egaIsm: q.egaIsm }));

    // Tasdiq kutayotgan MENING topshirishim (bo'lsa) — xodim "pul qayerda"ni ko'rsin.
    const ochiqTopshirish = kutilayotganlar.find(
      (t) => t.fromAccountId === meniki.id && t.turi === "smena"
    );

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Mening kassam</h1>
          <p className="text-sm text-muted mt-1">
            {xodim?.ism ?? session.ism} · {business?.nomi ?? "—"} · Qo&apos;lingizdagi naqd pul
          </p>
        </div>

        <KutilayotganTransferlar
          transferlar={kutilayotganlar}
          meniUserId={session.userId}
          boshqaruvchi={false}
        />

        <KassamClient
          accountId={meniki.id}
          mavjud={detal.mavjud}
          kutilayotganChiqim={detal.kutilayotganChiqim}
          smenaKirim={detal.smenaKirim}
          smenaChiqim={detal.smenaChiqim}
          smenaBoshi={detal.smenaBoshi}
          smenaTopshirishdan={detal.smenaTopshirishdan}
          harakatlar={detal.harakatlar}
          nishonlar={nishonlar}
          ochiqTopshirish={
            ochiqTopshirish
              ? {
                  summa: ochiqTopshirish.summa,
                  kimga: ochiqTopshirish.toUserIsm ?? ochiqTopshirish.toNomi,
                  vaqt: ochiqTopshirish.createdAt,
                }
              : null
          }
        />
      </div>
    );
  });
}
