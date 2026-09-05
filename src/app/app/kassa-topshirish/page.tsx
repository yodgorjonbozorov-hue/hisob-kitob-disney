import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/permissions/tekshir";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listTopshirishlar } from "@/lib/queries/accounts";
import { TopshirishlarClient } from "./TopshirishlarClient";

/**
 * KASSA TOPSHIRISHLAR — DIREKTORNING QABUL QILISH SAHIFASI.
 *
 * ═══ NEGA ALOHIDA SAHIFA ═══
 * Topshirish IKKI operatsiya: xodim topshiradi, direktor QABUL QILADI.
 * Ikkinchisi ilgari faqat Kassalar sahifasining yuqorisidagi kichik panelda
 * turardi — u yerda topshirish oddiy pul o'tkazmalari bilan aralashib
 * ketardi va tarix umuman ko'rinmasdi. Endi direktorda "kim, qancha, qaysi
 * kassadan, qachon va qaysi holatda" savoliga javob beradigan o'z sahifasi
 * bor.
 *
 * ═══ HUQUQ ═══
 * Sahifa boshqa xodimlarning kassa summalarini ko'rsatadi, ya'ni bu
 * "kassa.jami" darajasi (default: faqat OWNER/ADMIN). Huquqsiz odam
 * "Mening kassam"ga yo'naltiriladi — ma'lumot UI'da yashirilmaydi, so'rovning
 * o'zi ketmaydi. Qabul/rad amalining o'zini `PATCH /api/kassa-transfer/[id]`
 * mustaqil tekshiradi ("pul.qabul" + xizmat qatlamidagi qoida).
 */
export default async function KassaTopshirishPage() {
  const { session, tenantId } = await requireTenantPage();
  return runWithTenant(tenantId, async () => {
    if (!(await hasPermission(session.userId, "kassa.jami"))) {
      redirect("/app/kassam");
    }

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Kassa topshirishlar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const [kutilayotganlar, tarix, qabulQila] = await Promise.all([
      listTopshirishlar(businessId, ["kutilmoqda"], 50),
      // Tarix — qabul qilingan va rad etilganlar. "bekor" ham shu yerda:
      // u yakunlangan topshirishning stornosi va direktorga ko'rinishi kerak.
      listTopshirishlar(businessId, ["bajarildi", "rad", "bekor"], 50),
      hasPermission(session.userId, "pul.qabul"),
    ]);

    return (
      <div className="space-y-4 sm:space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Kassa topshirishlar</h1>
          <p className="text-2xs sm:text-sm text-muted mt-0.5 truncate">
            {business?.nomi ?? "—"}
            <span className="hidden sm:inline">
              {" "}
              · xodim topshiradi, siz qabul qilasiz — pul faqat qabuldan keyin ko&apos;chadi
            </span>
          </p>
        </div>

        <TopshirishlarClient
          kutilayotganlar={kutilayotganlar}
          tarix={tarix}
          qabulQila={qabulQila && isManager(session.rol)}
        />
      </div>
    );
  });
}
