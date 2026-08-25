import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { withTenant } from "@/lib/auth/tenant";
import { getAccessibleBusinesses, resolveActiveBusinessId } from "@/lib/business";
import { getEnabledModules } from "@/lib/modules/guard";
import { userHuquqlari } from "@/lib/permissions/tekshir";
import { isPro } from "@/lib/billing/pro";

/**
 * JORIY FOYDALANUVCHI PROFILI — mobil klient uchun yagona boshlang'ich nuqta.
 * Sessiyani tiklashda ilova shu javobdan foydalanuvchi, bizneslar ro'yxati,
 * aktiv biznes, yoqilgan modullar va huquqlarni oladi. Veb bu ma'lumotni
 * server komponentlarda to'g'ridan-to'g'ri oladi, shuning uchun bu route
 * faqat mobil/API klientlar uchun.
 *
 * `billing: true` — obuna tugagan bo'lsa ham profil qaytadi (402 emas):
 * klient `access.mode` ga qarab billing ekranini ko'rsatadi.
 */
const tenantHandler = withTenant(
  async (_request, _routeCtx, tenant) => {
    const session = tenant.session;
    const [businesses, activeBusinessId, modullar, huquqlar] = await Promise.all([
      getAccessibleBusinesses(session),
      resolveActiveBusinessId(session),
      getEnabledModules(tenant),
      userHuquqlari(session.userId),
    ]);
    return NextResponse.json({
      userId: session.userId,
      ism: session.ism,
      login: session.login,
      rol: session.rol,
      tenantId: tenant.tenantId,
      businessId: session.businessId,
      mustChangePassword: session.mustChangePassword,
      tenant: {
        id: tenant.tenant.id,
        name: tenant.tenant.name,
        plan: tenant.tenant.plan,
        status: tenant.tenant.status,
        pro: isPro(tenant.tenant.plan),
      },
      access: tenant.access,
      businesses,
      activeBusinessId,
      modullar: Array.from(modullar),
      ruxsatlar: Array.from(huquqlar),
    });
  },
  { billing: true }
);

export async function GET(request: NextRequest) {
  // SUPERADMIN tenantsiz — withTenant 403 qaytarardi. Mobil klient rolni
  // ko'rib "superadmin paneli faqat vebda" xabarini ko'rsatishi uchun minimal
  // profil qaytariladi (faqat sessiya ma'lumoti, bazaga murojaat yo'q).
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
  }
  if (session.rol === "SUPERADMIN") {
    return NextResponse.json({
      userId: session.userId,
      ism: session.ism,
      login: session.login,
      rol: session.rol,
      tenantId: null,
      businessId: null,
      mustChangePassword: session.mustChangePassword,
      tenant: null,
      access: null,
      businesses: [],
      activeBusinessId: null,
      modullar: [],
      ruxsatlar: [],
    });
  }
  return tenantHandler(request, undefined);
}
