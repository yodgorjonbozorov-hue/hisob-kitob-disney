import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { prisma } from "@/lib/prisma";
import { korinadiganModullar } from "@/lib/modules/registry";
import { planByCode } from "@/lib/billing/plans";
import { ModullarClient } from "./ModullarClient";

/** Sozlamalar → Modullar: tenant o'z modullarini yoqadi/o'chiradi (faqat OWNER). */
export default async function ModullarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId, tenant } = ctx;
  return runWithTenant(tenantId, async () => {
    if (session.rol !== "OWNER") {
      redirect("/app");
    }

    const [rows, omborliBizneslar] = await Promise.all([
      prisma.tenantModule.findMany({ select: { code: true, isActive: true } }),
      prisma.business.count({ where: { omborli: true } }),
    ]);
    const holatlar = new Map(rows.map((r) => [r.code, r.isActive]));
    const plan = planByCode(tenant.plan);

    const kartalar = korinadiganModullar().map((m) => {
      const yoqilgan = m.core || (holatlar.get(m.code) ?? false);
      // OMBOR moduli tenant darajasida, `Business.omborli` esa biznes darajasida.
      // Ikkalasi ham kerak — modul yoqiq bo'lsa-yu biznes belgilanmagan bo'lsa,
      // menyuda "Ombor"/"Sotuv" chiqmaydi va sabab ko'rinmay qoladi.
      const ogohlantirish =
        m.code === "OMBOR" && yoqilgan && omborliBizneslar === 0
          ? "Modul yoqilgan, ammo hech bir bizneste ombor yuritish belgilanmagan — shuning uchun menyuda \"Ombor\" va \"Sotuv\" ko'rinmaydi. Bizneslar bo'limida kerakli biznes uchun \"Omborni yoqish\" tugmasini bosing."
          : undefined;
      return {
        code: m.code,
        nomi: m.nomi,
        tavsif: m.tavsif,
        core: m.core,
        tarifdaBor: m.core || (plan?.modullar.includes(m.code) ?? false),
        yoqilgan,
        ogohlantirish,
      };
    });

    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-fg">Modullar</h1>
          <p className="text-sm text-muted mt-1">
            Biznesingizga kerakli bo'limlarni yoqing. O'chirilgan modul ma'lumotlari o'chmaydi —
            qayta yoqsangiz hammasi joyida bo'ladi.
          </p>
        </div>
        <ModullarClient kartalar={kartalar} />
      </div>
    );
  });
}
