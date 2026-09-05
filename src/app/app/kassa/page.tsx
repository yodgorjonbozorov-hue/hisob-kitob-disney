import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/permissions/tekshir";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listKassaHarakatlari } from "@/lib/queries/accounts";
import { getKassaNazorat } from "@/lib/queries/kassaNazorat";
import { davrBoshi, davrOqi } from "@/lib/kassaDavr";
import { KassaClient } from "./KassaClient";

/**
 * KASSALAR — PUL NAZORATI MARKAZI.
 *
 * Sahifa oltita savolga javob beradi: hozir jami qancha pul bor, u qaysi
 * kassada, bugun qancha kirdi va chiqdi, kim hali kassani topshirmadi,
 * topshirishda kamomad bormi, pul kimdan kimga o'tdi.
 *
 * ═══ TENANT / BIZNES IZOLYATSIYASI ═══
 * Butun sahifa `runWithTenant` ichida ishlaydi (tenant-scoped `prisma`), har
 * so'rov esa AYNI shu sessiyaning aktiv `businessId` si bilan cheklanadi.
 * Boshqa biznesning kassasi, o'tkazmasi yoki topshirig'i bu yerga hech
 * qanday yo'l bilan tushmaydi.
 *
 * ═══ HUQUQ (KASSA MAXFIYLIGI) ═══
 * Bu sahifa BARCHA kassalarning qoldig'ini, jami pulni va biznesning kunlik
 * kirim/chiqimini ko'rsatadi — bu "kassa.jami" darajasi (default: faqat
 * OWNER/ADMIN). Oddiy xodim (kassir/sotuvchi) "kassa.korish" bilan
 * "Mening kassam"ga yo'naltiriladi va faqat O'Z kassasini ko'radi; huquqi
 * umuman bo'lmasa — tranzaksiyalarga. Ma'lumot UI'da yashirilmaydi —
 * huquqsiz so'rovda so'rovning o'zi ketmaydi (API'lar ham shunday).
 *
 * Amal huquqlari (`pul.berish`, `pul.qabul`, boshqaruvchilik) client'ga
 * BAYROQ sifatida uzatiladi — tugmani yashirish uchun. Amalning o'zini esa
 * har API route mustaqil tekshiradi.
 */
export default async function KassaPage({
  searchParams,
}: {
  searchParams?: { davr?: string };
}) {
  const { session, tenantId } = await requireTenantPage();
  return runWithTenant(tenantId, async () => {
    if (!(await hasPermission(session.userId, "kassa.korish"))) {
      redirect("/app/tranzaksiyalar");
    }
    if (!(await hasPermission(session.userId, "kassa.jami"))) {
      redirect("/app/kassam");
    }

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Kassalar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const davr = davrOqi(searchParams?.davr);
    const [nazorat, harakatlar, transferQila, qabulQila] = await Promise.all([
      getKassaNazorat(businessId),
      listKassaHarakatlari(businessId, davrBoshi(davr), 40),
      hasPermission(session.userId, "pul.berish"),
      hasPermission(session.userId, "pul.qabul"),
    ]);

    return (
      <div className="space-y-4 sm:space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-fg">Kassalar</h1>
            {/* Telefonda faqat biznes nomi — uzun izoh o'sha yerda kesilib
                "...ni..." bo'lib qolardi va hech qanday ma'no bermasdi. */}
            <p className="text-2xs sm:text-sm text-muted mt-0.5 truncate">
              {business?.nomi ?? "—"}
              <span className="hidden sm:inline"> · pul qayerda va bugun nima bo&apos;ldi</span>
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {/* Topshirishlar ALOHIDA sahifada: bu yerda pul qayerda turgani,
                u yerda esa harakat talab qiladigan qabul ro'yxati. */}
            <Link
              href="/app/kassa-topshirish"
              className="inline-flex items-center rounded-lg bg-surface-2 px-3 min-h-[44px] text-sm font-medium text-muted hover:text-fg"
            >
              Topshirishlar
            </Link>
            <Link
              href="/app/kassa/hisobot"
              className="inline-flex items-center rounded-lg bg-surface-2 px-3 min-h-[44px] text-sm font-medium text-muted hover:text-fg"
            >
              Hisobot
            </Link>
          </div>
        </div>

        <KassaClient
          nazorat={nazorat}
          harakatlar={harakatlar}
          davr={davr}
          meniUserId={session.userId}
          boshqaruvchi={isManager(session.rol)}
          transferQila={transferQila}
          qabulQila={qabulQila}
          businessId={businessId}
          shaxsiyKassa={business?.shaxsiyKassa ?? false}
        />
      </div>
    );
  });
}
