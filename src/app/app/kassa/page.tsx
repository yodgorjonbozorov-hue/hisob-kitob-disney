import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/permissions/tekshir";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import {
  getAccountBalances,
  getKassaKunlik,
  listKutilayotganTransferlar,
  listTransfers,
  type KassaKunlik,
} from "@/lib/queries/accounts";
import {
  listKassirQoldiqlari,
  listKutilayotganTopshiriqlar,
  listTopshiriqlar,
} from "@/lib/queries/kassirKassa";
import { toshkentBugunBoshi } from "@/lib/services/kassirKassa";
import { KassirlarPaneli } from "@/components/kassa/KassirlarPaneli";
import { TopshiriqlarPaneli } from "@/components/kassa/TopshiriqlarPaneli";
import { KutilayotganTransferlar } from "@/components/kassa/KutilayotganTransferlar";
import { KassaTarix } from "@/components/kassa/KassaTarix";
import { KassaClient } from "./KassaClient";
import { RejimPaneli } from "./RejimPaneli";

/**
 * KASSALAR — har pul manbai bo'yicha joriy qoldiq.
 *
 * BARCHA xodimlar (kassir ham) barcha kassalarni ko'radi: "boshqa kassada
 * qancha pul bor" — bu sir emas, ish uchun kerak. Boshqaruv amallari
 * (kassa ochish/tahrirlash, rejim) esa huquq bilan qulflangan.
 */
export default async function KassaPage() {
  const { session, tenantId } = await requireTenantPage();
  return runWithTenant(tenantId, async () => {
    if (!(await hasPermission(session.userId, "kassa.korish"))) {
      redirect("/app/tranzaksiyalar");
    }

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-fg">Kassalar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const boshqaruvchi = isManager(session.rol);
    const [
      qoldiqlar,
      kunlikMap,
      transferlar,
      kutilayotganTransferlar,
      transferQila,
    ] = await Promise.all([
      getAccountBalances(businessId),
      getKassaKunlik(businessId, toshkentBugunBoshi()),
      listTransfers(businessId, 20),
      listKutilayotganTransferlar(businessId),
      hasPermission(session.userId, "pul.berish"),
    ]);

    const kunlik: Record<string, KassaKunlik> = Object.fromEntries(kunlikMap);
    const meniKassam = qoldiqlar.find((q) => q.userId === session.userId && q.isActive)?.id ?? null;

    // KASSIR KASSASI (eski topshirish oqimi) — faqat boshqaruvchiga ko'rinadi.
    const [kassirlar, kutilayotganlar, topshiriqTarix, barchaUserlar] = boshqaruvchi
      ? await Promise.all([
          listKassirQoldiqlari(businessId),
          listKutilayotganTopshiriqlar(businessId),
          listTopshiriqlar(businessId, 20),
          prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, ism: true },
            orderBy: { ism: "asc" },
          }),
        ])
      : [[], [], [], []];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">Kassalar</h1>
            <p className="text-sm text-muted mt-1">
              Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Har
              kassaning joriy qoldig&apos;i va bugungi harakati
            </p>
          </div>
          <Link
            href="/app/kassa/hisobot"
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-medium text-muted hover:text-fg"
          >
            Hisobot
          </Link>
        </div>

        <KutilayotganTransferlar
          transferlar={kutilayotganTransferlar}
          meniUserId={session.userId}
          boshqaruvchi={boshqaruvchi}
        />

        <KassaClient
          qoldiqlar={qoldiqlar}
          kunlik={kunlik}
          transferlar={transferlar}
          meniUserId={session.userId}
          meniKassam={meniKassam}
          boshqaruvchi={boshqaruvchi}
          transferQila={transferQila}
        />

        {boshqaruvchi && (
          <>
            <RejimPaneli businessId={businessId} yoqilgan={business?.shaxsiyKassa ?? false} />
            {/* KASSA TOPSHIRISH (eski oqim) — kirim/chiqim raqamlariga tegmaydi. */}
            <TopshiriqlarPaneli topshiriqlar={kutilayotganlar} />
            <KassirlarPaneli kassirlar={kassirlar} userlar={barchaUserlar} />
            <KassaTarix
              tarix={topshiriqTarix}
              sarlavha="Kassa topshiriqlari tarixi"
              kassirKorsatilsin
            />
          </>
        )}
      </div>
    );
  });
}
